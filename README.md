# AcervoTCC

O **AcervoTCC** é uma plataforma web acadêmica para guardar trabalhos concluídos, pesquisar referências e compartilhar ideias de novos TCCs. O projeto foi organizado no padrão MVC usado nas aulas: models Mongoose, controllers por entidade, rotas Express e telas EJS.

## Funcionalidades implementadas

- cadastro e login com perfis de aluno e professor (mantidos como estavam nesta etapa);
- senha protegida com hash;
- catálogo público de TCCs com pesquisa, filtros por curso, ano, área e orientador;
- ordenação por data, visualizações, acessos ao PDF e título;
- métricas de visualizações e acessos ao PDF;
- sugestões de TCCs relacionados por curso ou área;
- publicação, edição e exclusão de TCC pelo próprio aluno autor;
- envio opcional do trabalho em PDF, limitado a 5 MB;
- banco de ideias com pesquisa, curso, status e nível de dificuldade;
- publicação, edição e exclusão de ideias pelo próprio autor;
- comentários de alunos e professores em TCCs e ideias;
- filtro configurável de termos inadequados;
- painel com o resumo das contribuições do usuário;
- trilha pública “Aprenda a fazer seu TCC” com 11 etapas;
- exploração dos trabalhos por curso na página inicial;
- interface responsiva e acessível;
- modo demonstração quando o MongoDB não está configurado;
- execução local e entrada preparada para a Vercel.

## Tecnologias

- Node.js e Express;
- EJS, HTML, CSS e JavaScript;
- MongoDB e Mongoose;
- sessões com `express-session` e `connect-mongo`;
- `bcryptjs` para senhas;
- `multer` para arquivos PDF;
- `helmet` e limite de tentativas de login.

## Organização do projeto

```text
config/       conexão com o MongoDB
controllers/  regras das páginas e dos formulários
data/         dados usados no modo demonstração
middleware/   autenticação e controle de acesso
models/       esquemas do banco de dados
public/       CSS e JavaScript do navegador
routes/       endereços da aplicação
services/     persistência, validação, permissões e filtro
test/         testes unitários
views/        páginas e componentes EJS
```

O fluxo principal é simples:

```text
Rota → Controller → Service → Model → MongoDB
                    ↘ dados de demonstração
```

## Como executar

### 1. Instalar o Node.js

Use o Node.js 18 ou superior. Confirme no terminal:

```bash
node --version
npm --version
```

### 2. Baixar e abrir o projeto

```bash
git clone https://github.com/kelydacruz/fanzendoTCCv3.0.git
cd fanzendoTCCv3.0
```

### 3. Instalar as dependências

```bash
npm install
```

### 4. Escolher o modo de execução

Para testar rapidamente, não é necessário configurar banco. O sistema abrirá no modo demonstração.

Para usar MongoDB, copie `.env.example` para `.env` e preencha:

```env
MONGODB_URI=mongodb+srv://USUARIO:SENHA@CLUSTER/BANCO
SESSION_SECRET=uma-chave-longa-e-dificil-de-adivinhar
TERMOS_PROIBIDOS=termo1,termo2
PORT=3001
```

Não envie o arquivo `.env` ao GitHub.

### 5. Iniciar o servidor

```bash
npm start
```

Acesse [http://localhost:3001](http://localhost:3001).

Durante o desenvolvimento, também é possível usar:

```bash
npm run dev
```

## Contas de demonstração

Quando o MongoDB não está configurado:

| Perfil | E-mail | Senha |
|---|---|---|
| Aluno | `aluna@exemplo.com` | `123456` |
| Professor | `professora@exemplo.com` | `123456` |

Os dados criados no modo demonstração ficam somente na memória e são reiniciados quando o servidor para.

## Regras de acesso

| Ação | Visitante | Aluno | Professor |
|---|:---:|:---:|:---:|
| Consultar TCCs e ideias | Sim | Sim | Sim |
| Comentar | Não | Sim | Sim |
| Compartilhar ideias | Não | Sim | Sim |
| Publicar TCC | Não | Sim | Não |
| Editar/excluir publicação própria | Não | Sim | Sim |

O professor pode editar ou excluir apenas as próprias ideias. TCCs pertencem ao aluno que os publicou.

## Testes

```bash
npm test
```

Os testes verificam normalização de texto, filtro de conteúdo, validação de formulários e permissões de autoria.

## Implantação na Vercel

O projeto já possui `vercel.json` e `api/index.js`. Antes de publicar, cadastre na Vercel as variáveis `MONGODB_URI` e `SESSION_SECRET`. Em produção, `SESSION_SECRET` é obrigatória.

## Limites desta etapa

A autenticação existente foi mantida sem novas decisões nesta etapa. A forma final de login, cadastro e confirmação de perfis será definida posteriormente. Recuperação de senha, aprovação administrativa, notificações e armazenamento externo dos PDFs também podem ser tratados em uma etapa futura.
