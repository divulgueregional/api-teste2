# WhatsAPI

> An awesome WhatsApp API based on TypeScript

## Project structure

<pre>
.
|-- Dockerfile
|-- README.md
|-- docker-compose.yml
|-- instances
|   `-- MyNewInstance.json
|-- jest.config.js
|-- package-lock.json
|-- package.json
|-- src
|   |-- Server.integration.spec.ts
|   |-- Server.ts
|   |-- config
|   |   |-- env
|   |   |   `-- index.ts
|   |   |-- index.ts
|   |   `-- logger
|   |       `-- index.ts
|   |-- controllers
|   |   `-- InstanceController.ts
|   |-- index.ts
|   |-- models
|   |   `-- SendMessge.ts
|   `-- services
|       |-- Instance.ts
|       `-- instances
|           `-- MyNewInstance.json
|-- tsconfig.compile.json
|-- tsconfig.json
`-- views
    `-- swagger.ejs

10 directories, 20 files

</pre>

## Updating to newer versions

```shell
git add .
git commit -m "commit_message"
git push origin master
```

<hr>

# Server Commands

## Installing latest version of node js

```shell
curl -sL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install nodejs
sudo npm install -g npm@latest
```

## Installing required packages

```shell
sudo npm install -g pm2
```

## Builing the project

```shell
cd api
npm build
```

## Starting the project

```shell
sudo pm2 start npm --name WhatsAPINodeJs -- run "start:prod"
sudo pm2 status WhatsAPINodeJs
sudo pm2 restart WhatsAPINodeJs
```

## Deploying new versions

```shell
git pull origin master
npm install
npm run-script build
pm2 restart WhatsAPI
```

## Meu processo

# definir senha do usuario root

digite comando abaixo e após insira a senha do usuario root

```shell
cd ~
sudo -i
bash <(wget -qO- https://raw.githubusercontent.com/leitura/senharoot/main/senharoot.sh)
```

# Instando o nodejs v16.15.1

```shell
cd ~
sudo apt update && sudo apt upgrade
sudo apt install curl git
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# só use esse código caso nvm install 16.15.1 não executar
# então use esse código abaixo primeiro e
# depois execute nvm install 16.15.1
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 16.15.1
node -v

# instalação antiga
#curl -sL https://deb.nodesource.com/setup_16.x -o nodesource_setup.sh
#sudo bash nodesource_setup.sh
#sudo apt-get install -y nodejs
#node -v
```

## Instando o GIT

```shell
sudo apt-get install git
git --version
```

## Baixando a api do bayleys

```shell
git clone https://github.com/divulgueregional/api-teste2/api-teste
```

## Instalação complementar

```shell
sudo npm install -g npm@latest
sudo npm install -g pm2
```

## Instalação do nano - caso precise

```shell
# atualização de pacotes
sudo apt-get update
sudo apt-get install nano
```

## Acessando a api e instação final

```shell
cd api
# renomei o arquivo .env.development para .env
mv .env.development .env
# aletarar .env
nano .env
# use a seta e Edite o arquivo conforme necessário
# Para salvar as alterações, pressione "Ctrl + O" e em seguida, "Enter"
# Para sair, pressione "Ctrl + X"

#verificar se existe a pasta intances_data, caso não tiver precisa colocar ela

npm install -g typescript
npm install -g ts-node
npm install
npm run-script build
pm2 start npm --name WhatsAPINodeJs -- run "start:prod"
pm2 status WhatsAPINodeJs
pm2 restart WhatsAPINodeJs

#erro de permissão: /root/WhatsAPI-limpo/node_modules/.bin/cross-env: Permission denied
chmod +x /root/WhatsAPI-limpo/node_modules/.bin/cross-env
```

# Endereço da api

```shell
http://ip_do_servidor:8000/v3/docs/
```

# Arquivo de configurações na pasta raiz

.env <br>
Altere o arquivo .env <br>
Primeiro: cadastre-se em https://dashboard.pusher.com/apps/ <br>
Gere 1 app <br>
entre em keys <br>
e informe os valores no arquivo .env <br>
PUSHER_APP_ID = "" <br>
PUSHER_KEY = "" <br>
PUSHER_SECRET = "" <br>
PUSHER_CLUSTER = "" <br>
Definior o nome que vai aparecer ao ler o qrcode no celular
BROWSER_CLIENT = "api-balileys"

# Caso precise intalar Vim (Alterar arquivo)

```shell
sudo apt install vim
```

Comandos:
abrir arquivo: vi .env;
editar: insert;
salvar e sair: :wq;
salvar: :w;
sair: :q

# Comandos pm2

Restart

```shell
pm2 restart 0
pm2 restart all
```

Status

```shell
pm2 status
```

Salvar

```shell
pm2 save
```

Monitor

```shell
pm2 monit
```

Log

```shell
pm2 log
```

# Desinstalar pm2

Inicialização desativada:

```shell
pm2 unstartup
```

Mate o daemon:

```shell
pm2 kill
```

Desinstalação:

```shell
npm remove pm2 -g
```

Remova todas as configurações e logs salvos:

```shell
rm -rf ~/.pm2
```

# Desinstalar Node

Se você deseja desinstalar o NodeJS do seu sistema Ubuntu, execute o comando abaixo.

```shell
sudo apt-get remove nodejs
```

Para remover o pacote e os arquivos de configuração, execute:

```shell
sudo apt-get purge nodejs
```

Como etapa final, você pode executar o comando abaixo para remover todos os arquivos não utilizados e liberar espaço em disco

```shell
sudo apt-get autoremove
```
