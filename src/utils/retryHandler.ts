import { proto } from "@divulgueregional/baileys";
export class MessageRetryHandler {
  public messagesMap: Record<
    string,
    {
      ts: number;
      message: proto.IMessage;
    }
  >;

  constructor() {
    this.messagesMap = {};

    // Clear the messages_map every 10 seconds
    setInterval(() => {
      this.clearObseleteMessages();
    }, 10_000);
  }

  addMessage = async (message: proto.IWebMessageInfo) => {
    const id = message.key.id ?? "";

    this.messagesMap[id] = {
      message: this.cleanMessage(message),
      ts: Date.now(),
    };

    return message;
  };

  getMessage = (msgKey: string): proto.IMessage => {
    return this.messagesMap[msgKey].message;
  };

  removeMessage = (msgKey: string) => {
    delete this.messagesMap[msgKey];
  };

  getMessageKeys = (): string[] => {
    return Object.keys(this.messagesMap);
  };

  cleanMessage = (message: proto.IWebMessageInfo): proto.IMessage => {
    const msg = message.message ?? {};
    return msg;
  };

  clearObseleteMessages = () => {
    // Check if the message is older than 60 seconds
    const keys = Object.keys(this.messagesMap);
    keys.forEach((key) => {
      const ts = this.messagesMap[key].ts;
      if (Date.now() - ts > 60_000) {
        this.removeMessage(key);
      }
    });
  };

  messageRetryHandler = async (message: proto.IMessageKey) => {
    const msg = this.getMessage(message.id ?? "");
    console.log("Retrying message", msg);

    return msg;
  };
}
