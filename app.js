import { prepararCsrf, validarCsrf } from './middleware/csrf.js';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import conectarBanco from './config/conexao.js';
import { adicionarUsuarioNasTelas, validarUsuarioDaSessao } from './middleware/autenticacao.js';
import { classeStatus } from './services/texto.js';
import routes from './routes/route.js';
import usuarioRoutes from './routes/UsuarioRoutes.js';
import tccRoutes from './routes/TccRoutes.js';
import ideiaRoutes from './routes/IdeiaRoutes.js';
import adminRoutes from './routes/AdminRoutes.js';
import perfilRoutes from './routes/PerfilRoutes.js';
import { carregarTermosProibidos } from './services/filtroConteudo.js';
import { contarNotificacoesNaoLidas } from './services/notificacoes.js';
import notificacaoRoutes from './routes/NotificacaoRoutes.js';
import mensagemRoutes from './routes/MensagemRoutes.js';

const app = express();
const root = dirname(fileURLToPath(import.meta.url));
const emProducao = process.env.NODE_ENV === 'production';

if (emProducao) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.set('view engine', 'ejs');
app.set('views', join(root, 'views'));

app.use(helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
        directives: {
            'script-src': ["'self'", 'https://accounts.google.com'],
            'connect-src': ["'self'", 'https://accounts.google.com'],
            'frame-src': ['https://accounts.google.com'],
            'img-src': ["'self'", 'data:'],
        },
    },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use('/public', express.static(join(root, 'public')));

if (emProducao && !process.env.SESSION_SECRET) {
    throw new Error('Defina SESSION_SECRET antes de executar o sistema em produção.');
}

const configuracaoSessao = {
    name: 'acervotcc.sid',
    secret: process.env.SESSION_SECRET || 'segredo-apenas-para-desenvolvimento',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: emProducao,
        maxAge: 1000 * 60 * 60 * 8,
    },
};

if (process.env.MONGODB_URI) {
    configuracaoSessao.store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessoes',
    });
}

// O navegador guarda só o identificador; os dados da sessão ficam no servidor (MongoDB em produção).
app.use(session(configuracaoSessao));

app.use((req, res, next) => {
    Object.assign(res.locals, { usuario: null, caminhoAtual: req.path, mensagem: '', modoDemo: false, notificacoesNaoLidas: 0 });
    next();
});

app.use(async (req, res, next) => {
    try {
        const bancoConectado = await conectarBanco();
        req.modoDemo = !bancoConectado;
        await carregarTermosProibidos();
        res.locals.modoDemo = req.modoDemo;
        next();
    } catch (erro) { next(erro); }
});

app.use(validarUsuarioDaSessao);
app.use(adicionarUsuarioNasTelas);
app.use(prepararCsrf);

app.use(async (req, res, next) => {
    try {
        res.locals.notificacoesNaoLidas = req.session.usuario
            ? await contarNotificacoesNaoLidas(req.session.usuario.id)
            : 0;
        return next();
    } catch (erro) {
        return next(erro);
    }
});

app.use((req, res, next) => {
    res.locals.googleClientId = process.env.GOOGLE_CLIENT_ID || '';
    res.locals.dominioAluno = process.env.DOMINIO_ALUNO || 'academico.ifsul.edu.br';
    res.locals.dominioProfessor = process.env.DOMINIO_PROFESSOR || 'ifsul.edu.br';
    next();
});

app.locals.formatarData = (data) => new Intl.DateTimeFormat('pt-BR').format(new Date(data));
app.locals.formatarNumero = (valor) => new Intl.NumberFormat('pt-BR').format(Number(valor) || 0);
app.locals.idTexto = (valor) => String(valor?.id || valor?._id || valor || '');
app.locals.classeStatus = classeStatus;

// Formulários com PDF só podem ser verificados depois que o multer lê os campos.
app.use((req, res, next) => {
    if (req.is('multipart/form-data') && (req.path === '/tcc/add' || req.path.startsWith('/tcc/edt/'))) return next();
    return validarCsrf(req, res, next);
});
app.use(usuarioRoutes);
app.use(tccRoutes);
app.use(ideiaRoutes);
app.use(adminRoutes);
app.use(perfilRoutes);
app.use(notificacaoRoutes);
app.use(mensagemRoutes);
app.use(routes);

app.use((req, res) => {
    res.status(404).render('404', { title: 'Página não encontrada' });
});

app.use((erro, req, res, next) => {
    if (erro.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).render('erro', {
            title: 'Arquivo muito grande',
            mensagemErro: 'O PDF deve ter no máximo 5 MB.',
        });
    }

    if (erro.message === 'Envie apenas arquivos PDF.') {
        return res.status(400).render('erro', {
            title: 'Arquivo inválido',
            mensagemErro: erro.message,
        });
    }

    console.error(erro);

    return res.status(erro.status === 503 ? 503 : 500).render('erro', {
        title: 'Erro no sistema',
        mensagemErro: erro.status === 503 ? 'Banco de dados indisponível. Nenhum dado será salvo em modo demonstração. Tente novamente em instantes.' : 'Não foi possível concluir a operação. Tente novamente.',
    });
});

export default app;
