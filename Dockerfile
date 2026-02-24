FROM node:20-alpine

# Instala dependências nativas necessárias (comum em APIs de WhatsApp)
RUN apk update && apk add --no-cache build-base git python3 

WORKDIR /app

# Copia arquivos de configuração
COPY package.json ./
# Removi a cópia do package-lock.json pois ele não existe na raiz
# Se você tiver, pode adicionar novamente: COPY package-lock.json ./

# Instala as dependências
RUN npm install

# Copia o código fonte e configurações
COPY . .

# Executa o build (converte TS para JS na pasta dist)
# Nota: Verifiquei seu package.json e tsconfig.compile.json
RUN npm run tsc

EXPOSE 8081
ENV PORT 8081
ENV NODE_ENV production

CMD ["npm", "run", "start:prod"]

