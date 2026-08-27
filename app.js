import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import conectarBanco from './config/conexao.js';
import { adicionarUsuarioNasTelas } from './middleware/autenticacao.js';
import { classeStatus } from './services/texto.js';
import routes from './routes/route.js';
import usuarioRoutes from './routes/UsuarioRoutes.js';
import tccRoutes from './routes/TccRoutes.js';
import ideiaRoutes from './routes/IdeiaRoutes.js';

const app = express();
const root = dirname(fileURLToPath(import.meta.url));
const emProducao = process.env.NODE_ENV === 'production';

if (emProducao) app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', join(root, 'views'));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "script-src": ["'self'"],
            "img-src": ["'self'", 'data:'],
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
    secret: process.env.SESSION_SECRET || 'segredo-apenas-para-desenvolvimento',
    resave: false,
    saveUninitialized: false,
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

app.use(session(configuracaoSessao));

app.use(async (req, res, next) => {
    const bancoConectado = await conectarBanco();
    req.modoDemo = !bancoConectado;
    res.locals.modoDemo = req.modoDemo;
    next();
});

app.use(adicionarUsuarioNasTelas);

app.locals.formatarData = (data) => new Intl.DateTimeFormat('pt-BR').format(new Date(data));
app.locals.idTexto = (valor) => String(valor?.id || valor?._id || valor || '');
app.locals.classeStatus = classeStatus;

app.use(usuarioRoutes);
app.use(tccRoutes);
app.use(ideiaRoutes);
app.use(routes);

app.use((req, res) => {
    res.status(404).render('404', { title: 'Página não encontrada' });
});

app.use((erro, req, res, next) => {
    console.error(erro);

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

    return res.status(500).render('erro', {
        title: 'Erro no sistema',
        mensagemErro: 'Não foi possível concluir a operação. Tente novamente.',
    });
});

export default app;
