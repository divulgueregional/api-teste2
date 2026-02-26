// @ts-nocheck
import { Boom } from "@hapi/boom";
import { PlatformMulterFile } from "@tsed/common";
import { Forbidden, NotFound } from "@tsed/exceptions";
import makeWASocket, {
  AnyMessageContent,
  AuthenticationState,
  Chat,
  ConnectionState,
  Contact,
  DisconnectReason,
  DownloadableMessage,
  // @ts-ignore
  MessageRetryMap,
  UserFacingSocketConfig,
  WAMessage,
  downloadContentFromMessage,
  proto,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import axios from "axios";
import * as dotenv from "dotenv";
import fs, { rmSync } from "fs";
import https from "https"; // Added by Raj
import path from "path";
import PinoLogger from "pino";
import * as Pusher from "pusher";
import * as QRCode from "qrcode";
import { v4 } from "uuid";
import {
  Button,
  ButtonMessage,
  ButtonMessageWithImage,
  LocationMessage,
  SendListMessageData,
  SendVCardData,
} from "../models/SendMessge";
import { getEnv } from "../utils/processEnv";
import { MessageRetryHandler } from "./../utils/retryHandler";

dotenv.config();

const env = getEnv();

export interface ChatWithMessages extends Chat {
  // messages?: proto.IWebMessageInfo[];
  messages?: any;
  id: string;
}

export interface Instance {
  socket?: ReturnType<typeof makeWASocket>;
  key: string;
  connectionState?: string;
  qrCode?: string;
  chats: ChatWithMessages[];
  contacts: Contact[];
  messages: WAMessage[];
  hasReceivedMessages: boolean;
  hasReceivedChats: boolean;
  qrcodeCount: number;
}

export class WhatsAppInstance {
  // Instance key of  Instance
  public key: string = "";
  private authState: {
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  };
  public disableWebhook = false;

  public secondaryWebhookUrl = "";
  public sendSecondaryWebhookMessage: boolean = false;

  private axiosClient = axios.create({
    baseURL: env.WEBOOK_BASE_URL,
    httpsAgent: env.WEBOOK_SSL_VERIFY
      ? new https.Agent({
        rejectUnauthorized: env.WEBOOK_SSL_VERIFY,
      })
      : undefined,
  });

  msgRetryCounterMap: MessageRetryMap = {};

  private secondaryWebhookClient = axios.create({
    baseURL: this.secondaryWebhookUrl,
  });

  async sendWebhookMessage(data: any) {
    if (this.sendSecondaryWebhookMessage) {
      this.secondaryWebhookClient.post("", data).catch((e) => {
        return;
      });
    }

    if (env.DISABLE_WEBHOOK) {
      return;
    }

    if (this.disableWebhook) {
      return;
    }

    this.axiosClient.post("", data).catch((e) => {
      return;
    });
  }

  public updateWebhookData(data: { url?: string; sendMessage?: boolean }) {
    if (data.sendMessage !== undefined) {
      this.sendSecondaryWebhookMessage = data.sendMessage;
    }
    if (data.url) {
      this.secondaryWebhookUrl = data.url;
      this.secondaryWebhookClient = axios.create({
        baseURL: data.url,
      });
    }

    this.saveWebhookConfig();

    return {
      url: this.secondaryWebhookUrl,
      sendMessage: this.sendSecondaryWebhookMessage,
    };
  }

  private pusherInstance = new Pusher.default({
    appId: env.PUSHER_APP_ID,
    key: env.PUSHER_KEY,
    secret: env.PUSHER_SECRET,
    cluster: env.PUSHER_CLUSTER,
    useTLS: true,
  });

  msgHandler: MessageRetryHandler;

  // Socket config used to configure the WhatsApp socket
  private socketConfig: UserFacingSocketConfig;

  // Instance object with socket, key and connection state
  public instance: Instance = {
    key: this.key,
    chats: [],
    contacts: [],
    messages: [],
    hasReceivedMessages: false,
    hasReceivedChats: false,
    qrcodeCount: 0,
  };

  constructor(key?: string, disableWebhook = false) {
    // Check if user has provided a key. If not use random uuid
    this.key = key ? key : v4();
    this.disableWebhook = disableWebhook;

    this.msgHandler = new MessageRetryHandler();
    this.loadWebhookConfig();
  }

  private getWebhookConfigFile() {
    return path.resolve(process.cwd(), "instances_data", "webhooks", `${this.key}.json`);
  }

  private loadWebhookConfig() {
    try {
      const filePath = this.getWebhookConfigFile();
      console.log(`[WEBHOOK] Tentando carregar de: ${filePath}`);
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(fileContent);
        if (data.url) {
          this.secondaryWebhookUrl = data.url;
          this.secondaryWebhookClient = axios.create({
            baseURL: data.url,
          });
        }
        if (data.sendMessage !== undefined) {
          this.sendSecondaryWebhookMessage = data.sendMessage;
        }
        console.log(`[WEBHOOK SUCCESS] Configurações carregadas para ${this.key}`);
      } else {
        console.log(`[WEBHOOK INFO] Nenhum arquivo de config encontrado em ${filePath}`);
      }
    } catch (error) {
      console.log("[WEBHOOK ERROR] Erro ao carregar config:", error);
    }
  }

  private saveWebhookConfig() {
    try {
      const filePath = this.getWebhookConfigFile();
      const dirPath = path.dirname(filePath);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const config = {
        url: this.secondaryWebhookUrl,
        sendMessage: this.sendSecondaryWebhookMessage,
      };
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
      console.log(`[WEBHOOK SAVE] Configurações salvas em: ${filePath}`);
    } catch (error) {
      console.log("[WEBHOOK SAVE ERROR] Erro ao salvar config:", error);
    }
  }

  // Method to start the WhatsApp handlers and connect to WhatsApp
  async connect(): Promise<WhatsAppInstance> {
    this.authState = await useMultiFileAuthState(
      `./instances_data/${this.key}`
    );
    this.loadWebhookConfig(); // Reload after auth state just in case

    this.socketConfig = {
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      // @ts-ignore
      msgRetryCounterMap: this.msgRetryCounterMap,
      browser: [env.BROWSER_CLIENT, env.BROWSER_NAME, "10.0"],
      auth: this.authState.state,
      logger: PinoLogger({
        level: "silent",
      }),
      getMessage: this.msgHandler.messageRetryHandler,
    };

    this.instance.socket = makeWASocket(this.socketConfig);
    this.setHandlers();
    return this;
  }

  // Method to remove part after ":" in the jid
  makeUserId = (jid: string) => {
    return jid.split(":")[0] + "@s.whatsapp.net";
  };

  // Method to resolve LID to phone number if possible
  public resolveLid(jid: string): string {
    if (!jid) return jid;
    if (jid.endsWith("@s.whatsapp.net")) return jid;

    const numericPart = jid.split('@')[0];

    // 1. Busca profunda em TODOS os contatos usando stringify para não perder campos ocultos
    for (const contact of this.instance.contacts) {
      try {
        const contactStr = JSON.stringify(contact);
        if (contactStr.includes(numericPart)) {
          // Se encontrou o LID em qualquer lugar do objeto, procura por um JID de fone no mesmo objeto
          const phoneMatch = contactStr.match(/\d+@s\.whatsapp\.net/);
          if (phoneMatch) return phoneMatch[0];
        }
      } catch (e) { continue; }
    }

    // 2. Fallback: Procura nos CHATS com a mesma lógica agressiva
    for (const chat of this.instance.chats) {
      try {
        const chatStr = JSON.stringify(chat);
        if (chatStr.includes(numericPart)) {
          const phoneMatch = chatStr.match(/\d+@s\.whatsapp\.net/);
          if (phoneMatch) return phoneMatch[0];
        }
      } catch (e) { continue; }
    }

    return jid;
  }

  // Method to push msg to its corresponding chat
  pushMessage = (message: WAMessage) => {
    const chat = this.instance.chats.find(
      (chat) => chat.id === message.key.remoteJid && !message.key.fromMe
    );

    if (chat) {
      chat.messages?.push(message);
    }
  };

  getSelf() {
    return {
      key: this.key,
      user: this.instance.socket?.user,
      connectionState: this.instance.connectionState,
    };
  }

  // Method to get msgs from specific chat
  getMessages = (chatId: string) => {
    return this.instance.messages.filter(
      (message) => message.key.remoteJid === chatId
    );
  };

  // Handlers for the WhatsApp events
  setHandlers() {
    // Current socket
    const socket = this.instance.socket;

    // listen for when the auth credentials is updated
    socket?.ev.on("creds.update", this.authState.saveCreds);

    // Handle initial receiving of the chats
    // @ts-ignore
    socket?.ev.on("chats.set", ({ chats }) => {
      const chatsWithMessages = chats.map((chat) => {
        return {
          ...chat,
          messages: [],
        };
      });

      this.instance.chats.push(...chatsWithMessages);
    });

    // Handle new Chats
    socket?.ev.on("chats.upsert", (chats) => {
      const chatsWithMessages = chats.map((chat) => {
        return {
          ...chat,
          messages: [],
        };
      });

      this.instance.chats.push(...chatsWithMessages);
    });

    // Handle chat updates like name change, bla bla bla
    socket?.ev.on("chats.update", (chats) => {
      chats.map((chat) => {
        const index = this.instance.chats.findIndex((c) => c.id === chat.id);
        const orgChat = this.instance.chats[index];
        this.instance.chats[index] = {
          ...orgChat,
          ...chat,
        };
      });
    });

    // Handle chat deletes
    socket?.ev.on("chats.delete", (chats) => {
      chats.map((chat) => {
        const index = this.instance.chats.findIndex((c) => c.id === chat);
        this.instance.chats.splice(index, 1);
      });
    });

    // Handle receiving initial contacts
    socket?.ev.on("contacts.set", ({ contacts }) => {
      this.instance.contacts = contacts;
    });

    socket?.ev.on("contacts.upsert", (contacts) => {
      contacts.forEach(contact => {
        const index = this.instance.contacts.findIndex(c => c.id === contact.id);
        if (index > -1) {
          this.instance.contacts[index] = { ...this.instance.contacts[index], ...contact };
        } else {
          this.instance.contacts.push(contact);
        }
      });
    });

    socket?.ev.on("contacts.update", (updates) => {
      for (const update of updates) {
        const index = this.instance.contacts.findIndex((c) => c.id === update.id);
        if (index !== -1) {
          this.instance.contacts[index] = { ...this.instance.contacts[index], ...update };
        }
      }
    });

    // Handle incoming call

    socket?.ev.on("call", (calls) => {
      calls.map((call) =>
        this.sendWebhookMessage({
          type: "call",
          data: call,
          remoteJidFone: this.resolveLid(call.from),
          instance_key: this.key,
        })
      );
    });

    // Handle new messages
    socket?.ev.on("messages.upsert", (t) => {
      // @ts-ignore
      if (t.type == "prepend") {
        this.instance.messages.unshift(...t.messages);
      }

      if (t.type != "notify") {
        return;
      } // No new message is received

      // push new msg
      this.instance.messages.unshift(...t.messages);

      t.messages.map(async (m) => {
        if (!m.message) return; // if there is no text or media message

        // If msg is fromMe, then just don't proceed
        if (m.key.fromMe) return;

        const messageType = Object.keys(m.message)[0]; // get what type of message it is -- text, image, video
        // if messageType is protocolMessage, just dont send it
        if (
          ["protocolMessage", "senderKeyDistributionMessage"].includes(
            messageType
          )
        )
          return;

        const remoteJid = m.key.remoteJid;
        let remoteJidFone = this.resolveLid(remoteJid);

        // Fallback: Se ainda for LID, tenta ver se o participant tem o fone (comum em algumas versões)
        if (remoteJidFone.endsWith("@lid") && m.key.participant) {
          remoteJidFone = this.resolveLid(m.key.participant);
        }

        const messageToSend: any = {
          instance_key: this.key,
          jid: this.instance.socket?.user.id,
          messageType,
          remoteJid: remoteJid, // Mantém o original (pode ser @lid)
          remoteJidFone: remoteJidFone, // O fone resolvido ou o melhor identificado
          ...m,
        };

        // LID Resolution Logging
        if (remoteJid && remoteJid.endsWith("@lid")) {
          if (remoteJidFone !== remoteJid) {
            messageToSend.resolvedJid = remoteJidFone;
            console.log(`[LID SUCCESS] ${remoteJid} -> ${remoteJidFone}`);
          } else {
            console.log(`[LID INFO] Pendente resolução para ${remoteJid}`);
          }
        }

        // if it is a text message
        if (messageType === "conversation") {
          messageToSend["text"] = m;
        }

        this.sendWebhookMessage(messageToSend); // Send the message to the API
      });
    });

    // On connect event
    socket?.ev.on(
      "connection.update",
      async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect } = update;

        if (connection == "connecting") {
          return;
        }

        if (connection) {
          this.sendWebhookMessage({
            instance_key: this.key,
            connection_state: connection,
            messageType: "connection_update",
            closeReason: (lastDisconnect?.error as Boom)?.output.statusCode,
          });
          if (env.PUSHER_APP_ID !== "") {
            this.pusherInstance.trigger(this.key, "connection_update", {
              connectionState: connection,
              userData:
                connection == "open" ? this.instance.socket?.user : undefined,
            });
          }
        }

        if (connection === "close") {
          // reconnect if not logged out
          if (
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut
          ) {
            await this.connect();
          } else {
            rmSync(`./instances_data/${this.key}`, {
              recursive: true,
              force: true,
            });
            // @ts-ignore
            this.instance.socket.user = null;
          }
        }
        // Handle qrcode update
        if (update.qr) {
          if (this.instance.qrcodeCount >= 5) {
            this.instance.socket?.ev.removeAllListeners("connection.update");
            return this.instance.socket?.end(
              new Boom("QR code limit reached, please login again", {
                statusCode: DisconnectReason.badSession,
              })
            );
          }

          this.instance.qrcodeCount++;

          QRCode.toDataURL(update.qr).then((url: string) => {
            this.instance.qrCode = url;
            if (env.PUSHER_APP_ID !== "") {
              this.pusherInstance.trigger(this.key, "qrcode_update", {
                qrcode: url,
              });
            }
            this.sendWebhookMessage({
              instance_key: this.key,
              qrcode: url,
              messageType: "qrcode_update",
            });
          });
        }
      }
    );
  }

  createId(jid: string) {
    if (jid.includes("@g.us") || jid.includes("@s.whatsapp.net") || jid.includes("@lid")) {
      return jid;
    }

    return jid.includes("-") ? `${jid}@g.us` : `${jid}@s.whatsapp.net`;
  }

  // Check if jid is registered on WhatsApp
  async isRegistered(jid: string) {
    if (jid.includes("@g.us") || jid.includes("@lid")) {
      return { exists: true, jid };
    }

    const [result] = (await this.instance.socket?.onWhatsApp(
      this.createId(jid)
    )) as {
      exists: boolean;
      jid: string;
    }[];
    return result;
  }

  // Method to send a message to a user
  async sendMessageToMany(to: string[], text: string) {
    const validNumbers: string[] = [];
    const invalidNumbers: string[] = [];
    const dataToSend = {};

    await Promise.all(
      to.map(async (numer) => {
        // CCheck if numer is registerd
        if (await this.isRegistered(numer)) {
          validNumbers.push(numer);
        } else {
          invalidNumbers.push(numer);
        }
      })
    );

    await Promise.all(
      validNumbers.map(async (jid) => {
        dataToSend[jid] = await this.instance.socket
          ?.sendMessage(this.createId(jid), {
            text,
          })
          // @ts-ignore
          .then(this.msgHandler.addMessage);
      })
    );

    return {
      sent: validNumbers.length,
      failed: invalidNumbers.length,
      data: dataToSend,
    };
  }

  async downloadMessage(
    message: DownloadableMessage,
    messageType: "image" | "audio" | "video" | "document",
    outputFormat: "file"
  ) {
    let buffer = Buffer.from([]);
    try {
      const stream = await downloadContentFromMessage(message, messageType);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      } // download the media message
    } catch {
      throw new Forbidden("Unable to download file");
    }
    return buffer.toString("base64");
  }

  // send a single message
  async sendMessage(to: string, text: string) {
    if (!(await this.isRegistered(to))) {
      throw new Forbidden("Number not registered on WhatsApp");
    }
    const jid = this.createId(to);
    return await this.instance.socket
      ?.sendMessage(jid, {
        text,
      })
      .then(this.msgHandler.addMessage);
  }

  processButtons = (buttons: Button[]) => {
    const finalButtons: proto.IHydratedTemplateButton[] = [];

    buttons.map((button) => {
      if (button.type == "replyButton") {
        finalButtons.push({
          quickReplyButton: {
            displayText: button.title ?? "",
          },
        });
      }

      if (button.type == "callButton") {
        finalButtons.push({
          callButton: {
            displayText: button.title ?? "",
            phoneNumber: button.payload ?? "",
          },
        });
      }
      if (button.type == "urlButton") {
        finalButtons.push({
          urlButton: {
            displayText: button.title ?? "",
            url: button.payload ?? "",
          },
        });
      }
    });
    return finalButtons;
  };

  // Send a Media Message
  async sendMediaMessage(data: {
    to: string;
    type: "video" | "audio" | "image" | "document";
    caption?: string;
    bufferData: PlatformMulterFile;
  }) {
    if (!(await this.isRegistered(data.to))) {
      throw new Forbidden("User not registered on WhatsApp");
    }

    // @ts-ignore
    return await this.instance.socket
      ?.sendMessage(this.createId(data.to), {
        mimetype: data.bufferData.mimetype,
        [data.type]: data.bufferData.buffer,
        caption: data.caption,
        ptt: data.type == "audio" ? true : false,
        fileName:
          data.type == "document" ? data.bufferData.originalname : undefined, //added by Raj for document name appearance
      } as unknown as AnyMessageContent)
      .then(this.msgHandler.addMessage);
  }

  async sendUrlMediaMessage(data: {
    to: string;
    type: "video" | "audio" | "image" | "document";
    mimeType: string;
    caption?: string;
    url: string;
  }) {
    if (!(await this.isRegistered(data.to))) {
      throw new Forbidden("Number not registered on WhatsApp");
    }

    return await this.instance.socket
      ?.sendMessage(this.createId(data.to), {
        [data.type]: {
          url: data.url,
        },
        caption: data.caption,
        mimetype: data.mimeType,
      } as unknown as AnyMessageContent)
      .then(this.msgHandler.addMessage);
  }

  async sendUrlMediaButtonMessage(data: ButtonMessageWithImage) {
    if (!(await this.isRegistered(data.to))) {
      throw new Forbidden("Number not registered on WhatsApp");
    }

    // @ts-ignore
    return await this.instance.socket
      ?.sendMessage(this.createId(data.to), {
        [data.mediaType]: {
          url: data.imageUrl,
        },
        footer: data.footerText ?? "",
        caption: data.text,
        templateButtons: this.processButtons(data.buttons),
        mimetype: data.mimeType,
      } as unknown as AnyMessageContent)
      .then(this.msgHandler.addMessage);
  }

  async sendButtonsMessage(data: { to: string; buttonData: ButtonMessage }) {
    if (!(await this.isRegistered(data.to))) {
      throw new Forbidden("Number not registered on WhatsApp");
    }

    return await this.instance.socket
      ?.sendMessage(this.createId(data.to), {
        templateButtons: this.processButtons(data.buttonData.buttons),
        text: data.buttonData.text ?? "",
        footer: data.buttonData.footerText ?? "",
      })
      .then(this.msgHandler.addMessage)
      .catch((err) => { });
  }

  async sendLocationMessage(data: LocationMessage) {
    return await this.instance.socket
      ?.sendMessage(this.createId(data.to), {
        location: {
          degreesLatitude: data.coordinates.lat,
          degreesLongitude: data.coordinates.long,
        },
        text: data.caption,
        caption: data.caption,
      })
      .then(this.msgHandler.addMessage)
      .catch((err) => { });
  }

  async sendContactMessage(data: SendVCardData) {
    const vcard =
      "BEGIN:VCARD\n" + // metadata of the contact card
      "VERSION:3.0\n" +
      `FN:${data.vcard.fullName}\n` + // full name
      `ORG:${data.vcard.organization};\n` + // the organization of the contact
      `TEL;type=CELL;type=VOICE;waid=${data.vcard.phoneNumber}:${data.vcard.phoneNumber}\n` + // WhatsApp ID + phone number
      "END:VCARD";

    return await this.instance.socket
      ?.sendMessage(await this.createId(data.to), {
        contacts: {
          displayName: data.vcard.fullName,
          contacts: [{ displayName: data.vcard.fullName, vcard }],
        },
      })
      .then(this.msgHandler.addMessage);
  }

  async sendListMessage(data: SendListMessageData) {
    return await this.instance.socket
      ?.sendMessage(this.createId(data.to), {
        text: data.text,
        sections: data.sections,
        buttonText: data.buttonText,
        footer: data.description,
        title: data.title,
      })
      .then(this.msgHandler.addMessage);
  }

  async getAllGroups() {
    return this.instance.chats.filter((c) => c.id.includes("@g.us"));
  }

  async getGroupInfo(groupId: string, raiseError?: boolean) {
    const group = this.instance.chats.find((c) => c.id === groupId);

    if (!group) {
      throw new NotFound("Group not found");
    }
    try {
      const metadata = await this.instance.socket?.groupMetadata(groupId);
      return metadata;
    } catch (err) {
      if (raiseError == true) {
        throw new NotFound("Group not found");
      }
      return null;
    }
  }

  async getAdminGroups(withParticipants: boolean = false) {
    const user = this.instance.socket?.user;
    // @ts-ignore
    user.id = this.makeUserId(user?.id);

    const groups = await this.getAllGroups();

    const groupMetadata = await Promise.all(
      groups.map((g) => this.getGroupInfo(g.id, false))
    );

    const finalGroups = groupMetadata.filter((g) => {
      const result = g?.participants.find(
        (p) =>
          p.id == user?.id && ["admin", "superadmin"].includes(p.admin as any)
      );
      if (result) {
        return true;
      } else {
        false;
      }
    });

    return withParticipants
      ? finalGroups
      : //@ts-ignore
      finalGroups.map((g) => (g.participants = []));
  }

  async createGroup(name: string, participants: string[]) {
    const group = await this.instance.socket?.groupCreate(
      name,
      participants.map(this.createId)
    );

    return group;
  }

  async getGroupInviteCode(group_id: string) {
    const group = this.instance.chats.find((c) => c.id === group_id);

    if (!group) {
      throw new NotFound("Group not found");
    }

    return await this.instance.socket?.groupInviteCode(group_id);
  }

  async changeGroupSettings(
    group_id: string,
    setting: "announcement" | "not_announcement" | "locked" | "unlocked"
  ) {
    const group = this.instance.chats.find((c) => c.id === group_id);

    if (!group) {
      throw new NotFound("Group not found");
    }

    return await this.instance.socket?.groupSettingUpdate(group_id, setting);
  }

  async updateGroup(
    group_id: string,
    users: string[],
    action: "add" | "remove" | "promote" | "demote"
  ) {
    const group = this.instance.chats.find((c) => c.id === group_id);

    if (!group) {
      throw new NotFound("Group not found");
    }
    const results: any[] = [];

    for (let i = 0; i <= users.length - 1; i++) {
      const usr = users[i];
      await new Promise((resolve) => setTimeout(resolve, 1500));
      results.push(
        await this.instance.socket?.groupParticipantsUpdate(
          group.id,
          [this.createId(usr)],
          action
        )
      );
    }
    return results;
  }

  async leaveGroup(group_id: string) {
    const group = this.instance.chats.find((c) => c.id === group_id);

    if (!group) {
      throw new NotFound("Group not found");
    }
    return await this.instance.socket?.groupLeave(group_id);
  }
}

/* (async function () {
  const sock = new WhatsAppInstance();
  await sock.connect();
})();
 */
