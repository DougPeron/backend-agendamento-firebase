# API para Agendamento de Quadras (Backend Serverless)

![Status do Projeto](https://img.shields.io/badge/status-finalizado-green)

API RESTful desenvolvida com uma arquitetura serverless na plataforma Google Firebase, projetada para gerenciar o agendamento de quadras esportivas em aplicações web e mobile.

## Features

**Autenticação Segura:** Cadastro e login de usuários gerenciados pelo Firebase Authentication.
**Gestão de Agendamentos:** Endpoints para criar, consultar e cancelar agendamentos.
**Lógica Anti-Conflito:** O sistema impede de forma inteligente que dois agendamentos sejam marcados no mesmo horário para a mesma quadra.
**Infraestrutura Serverless:** Baixo custo, alta escalabilidade e sem necessidade de gerenciar servidores.

## Arquitetura e Tecnologias

Este projeto utiliza um conjunto de tecnologias modernas para garantir performance e escalabilidade:

| Tecnologias - Papel na Aplicação |

**Node.js** - Ambiente de execução para as funções.
**Express.js** - Framework para roteamento e gerenciamento da API dentro das Cloud Functions.
**Firebase Functions** - Plataforma serverless para execução do código de backend.
**Cloud Firestore** - Banco de dados NoSQL para persistência de dados (quadras, agendamentos, etc.).
**Firebase Authentication** - Serviço de gerenciamento de identidade para autenticação de usuários.
**ESLint** - Ferramenta para garantir a qualidade e o padrão do código.

## Pré-requisitos

Para utilizar é necessário ter as seguintes ferramentas instaladas:

- [Node.js](https://nodejs.org/en/) (versão 18 ou superior)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- Um projeto ativo no [console do Firebase](https://console.firebase.google.com/).

## Como Rodar o Projeto Localmente

Para desenvolvimento e testes, é altamente recomendado utilizar o Firebase Local Emulator Suite.

1.  **Clone o repositório:**

    ```bash
    git clone [URL-DO-SEU-REPOSITORIO]
    cd [NOME-DO-SEU-PROJETO]
    ```

2.  **Instale as dependências da função:**

    ```bash
    cd functions
    npm install
    ```

3.  **Conecte o projeto ao seu Firebase:**

    ```bash
    # Faça login na sua conta do Google
    firebase login

    # Adicione e configure o projeto localmente
    firebase use --add
    ```

    _Selecione o ID do projeto que você criou no console do Firebase._

4.  **Inicie o Emulador do Firebase:**
    _Volte para a pasta raiz do projeto (onde está o arquivo `firebase.json`)_
    ```bash
    cd ..
    firebase emulators:start
    ```
    O emulador iniciará os serviços de Functions, Firestore e Auth. A URL da sua API local será exibida no terminal (geralmente algo como `http://127.0.0.1:5001/[id-do-projeto]/us-central1/api`).

## Endpoints da API

A seguir estão os principais endpoints disponíveis. Rotas marcadas como `Privado` exigem um Token de Autenticação válido no cabeçalho.

Método - Endpoint

| `POST` - `/bookings` - Cria um novo agendamento.
| `GET` - `/bookings/my-bookings` - Lista todos os agendamentos do usuário logado.

**Como se autenticar:**

1.  Utilize um SDK cliente do Firebase (em seu frontend) para logar um usuário.
2.  Obtenha o `IdToken` gerado no login.
3.  Envie este token em todas as requisições para rotas privadas no cabeçalho `Authorization`:
    `Authorization: Bearer <SEU_ID_TOKEN>`

**Douglas Peron**

- LinkedIn: (https://www.linkedin.com/in/douglas-peron)
- GitHub: (https://github.com/DougPeron)

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
