import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const agora = Date.now();
const diasAtras = (dias) => new Date(agora - dias * 24 * 60 * 60 * 1000);

export const usuarios = [
    {
        id: 'usuario-aluna',
        nome: 'Kely Heloísa',
        email: 'aluna@exemplo.com',
        senha: bcrypt.hashSync('123456', 10),
        perfil: 'aluno',
        ativo: true,
        emailVerificado: true,
        curso: 'Técnico em Informática',
        areaAtuacao: '',
    },
    {
        id: 'usuario-professora',
        nome: 'Professora Ana',
        email: 'professora@exemplo.com',
        senha: bcrypt.hashSync('123456', 10),
        perfil: 'professor',
        ativo: true,
        emailVerificado: true,
        curso: '',
        areaAtuacao: 'Desenvolvimento de Sistemas',
    },
    {
        id: 'usuario-admin',
        nome: 'Administração AcervoTCC',
        email: 'admin@exemplo.com',
        senha: bcrypt.hashSync('123456', 10),
        perfil: 'admin',
        ativo: true,
        emailVerificado: true,
        curso: '',
        areaAtuacao: '',
    },
];

export const cursos = [
    { id: 'curso-informatica', nome: 'Técnico em Informática', sigla: 'INFO', area: 'Tecnologia', ativo: true },
    { id: 'curso-meio-ambiente', nome: 'Técnico em Meio Ambiente', sigla: 'MA', area: 'Meio Ambiente', ativo: true },
    { id: 'curso-administracao', nome: 'Técnico em Administração', sigla: 'ADM', area: 'Gestão', ativo: true },
];

export const areasAtuacao = [
    { id: 'area-desenvolvimento', nome: 'Desenvolvimento de Sistemas', ativo: true },
    { id: 'area-banco-dados', nome: 'Banco de dados', ativo: true },
    { id: 'area-redes', nome: 'Redes de computadores', ativo: true },
    { id: 'area-suporte', nome: 'Suporte e infraestrutura', ativo: true },
    { id: 'area-gestao', nome: 'Gestão e projetos', ativo: true },
];

export const turmas = [
    { id: 'turma-info-2024', nome: '3º ano', ano: 2024, cursoId: 'curso-informatica', ativo: true },
    { id: 'turma-info-2025', nome: '3º ano', ano: 2025, cursoId: 'curso-informatica', ativo: true },
];

export const tccs = [
    {
        id: 'horta-inteligente',
        titulo: 'Horta inteligente: automação e uso consciente da água',
        tema: 'Sustentabilidade e automação',
        resumo: 'Sistema de monitoramento de umidade e irrigação automatizada para hortas escolares, com painel web e sensores de baixo custo.',
        curso: 'Técnico em Informática',
        area: 'Internet das Coisas',
        turma: '3º ano',
        orientador: 'Prof. Ricardo Mendes',
        orientadorId: 'usuario-professora',
        coautores: ['Bruno Lima'],
        palavrasChave: ['IoT', 'Sustentabilidade', 'Automação'],
        ano: 2025,
        visualizacoes: 1284,
        downloads: 346,
        autorId: 'usuario-aluna',
        status: 'publicado',
        feedbackOrientador: '',
        createdAt: diasAtras(12),
        pdf: null,
    },
    {
        id: 'acolhe',
        titulo: 'Acolhe: apoio à saúde mental estudantil',
        tema: 'Tecnologia e saúde',
        resumo: 'Aplicação que aproxima estudantes dos canais de acolhimento e organiza conteúdos educativos sobre bem-estar e prevenção.',
        curso: 'Técnico em Informática',
        area: 'Tecnologia educacional',
        turma: '3º ano',
        orientador: 'Profa. Márcia Alves',
        orientadorId: 'usuario-professora',
        coautores: [],
        palavrasChave: ['Saúde mental', 'UX', 'Web'],
        ano: 2025,
        visualizacoes: 1032,
        downloads: 288,
        autorId: 'usuario-aluna',
        status: 'publicado',
        feedbackOrientador: '',
        createdAt: diasAtras(28),
        pdf: null,
    },
    {
        id: 'descarte-certo',
        titulo: 'Descarte Certo: educação ambiental na comunidade',
        tema: 'Sustentabilidade',
        resumo: 'Mapeamento colaborativo de pontos de coleta e campanha digital para estimular o descarte responsável de resíduos eletrônicos.',
        curso: 'Técnico em Meio Ambiente',
        area: 'Sustentabilidade',
        turma: '3º ano',
        orientador: 'Prof. Paulo Neri',
        orientadorId: 'usuario-professora',
        coautores: [],
        palavrasChave: ['Reciclagem', 'Comunidade', 'Educação'],
        ano: 2024,
        visualizacoes: 846,
        downloads: 219,
        autorId: 'usuario-aluna',
        status: 'publicado',
        feedbackOrientador: '',
        createdAt: diasAtras(45),
        pdf: null,
    },
];

export const ideias = [
    {
        id: 'ideia-enchentes',
        titulo: 'Aplicativo de alerta para enchentes locais',
        tema: 'Prevenção de desastres',
        descricao: 'Integrar dados meteorológicos e relatos da comunidade para produzir alertas rápidos e acessíveis.',
        curso: 'Técnico em Informática',
        dificuldade: 'Avançada',
        status: 'Disponível',
        autorId: 'usuario-professora',
        createdAt: diasAtras(3),
    },
    {
        id: 'ideia-biblioteca',
        titulo: 'Biblioteca acessível para estudantes com baixa visão',
        tema: 'Acessibilidade',
        descricao: 'Criar uma experiência de leitura com contraste, ampliação, áudio e recomendações de acessibilidade.',
        curso: 'Técnico em Informática',
        dificuldade: 'Intermediária',
        status: 'Em desenvolvimento',
        autorId: 'usuario-aluna',
        createdAt: diasAtras(7),
    },
    {
        id: 'ideia-financas',
        titulo: 'Cartilha financeira para jovens aprendizes',
        tema: 'Educação financeira',
        descricao: 'Produzir conteúdo prático sobre orçamento, crédito e primeiros investimentos para jovens.',
        curso: 'Técnico em Administração',
        dificuldade: 'Iniciante',
        status: 'Disponível',
        autorId: 'usuario-professora',
        createdAt: diasAtras(15),
    },
];

export const comentarios = [
    {
        id: 'comentario-1',
        texto: 'O problema está bem definido e pode render uma ótima demonstração prática.',
        autorId: 'usuario-professora',
        alvoTipo: 'tcc',
        alvoId: 'horta-inteligente',
        createdAt: diasAtras(2),
    },
    {
        id: 'comentario-2',
        texto: 'A ideia pode começar com um protótipo usando dados simulados.',
        autorId: 'usuario-aluna',
        alvoTipo: 'ideia',
        alvoId: 'ideia-enchentes',
        createdAt: diasAtras(1),
    },
];

export const notificacoes = [];

export function novoId() {
    return randomUUID();
}
