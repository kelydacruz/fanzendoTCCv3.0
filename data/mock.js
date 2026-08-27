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
        curso: 'Técnico em Informática',
        areaAtuacao: '',
    },
    {
        id: 'usuario-professora',
        nome: 'Professora Ana',
        email: 'professora@exemplo.com',
        senha: bcrypt.hashSync('123456', 10),
        perfil: 'professor',
        curso: '',
        areaAtuacao: 'Desenvolvimento de Sistemas',
    },
];

export const tccs = [
    {
        id: 'horta-inteligente',
        titulo: 'Horta inteligente: automação e uso consciente da água',
        tema: 'Sustentabilidade e automação',
        resumo: 'Sistema de monitoramento de umidade e irrigação automatizada para hortas escolares, com painel web e sensores de baixo custo.',
        curso: 'Técnico em Informática',
        orientador: 'Prof. Ricardo Mendes',
        coautores: ['Bruno Lima'],
        palavrasChave: ['IoT', 'Sustentabilidade', 'Automação'],
        ano: 2025,
        autorId: 'usuario-aluna',
        createdAt: diasAtras(12),
        pdf: null,
    },
    {
        id: 'acolhe',
        titulo: 'Acolhe: apoio à saúde mental estudantil',
        tema: 'Tecnologia e saúde',
        resumo: 'Aplicação que aproxima estudantes dos canais de acolhimento e organiza conteúdos educativos sobre bem-estar e prevenção.',
        curso: 'Técnico em Informática',
        orientador: 'Profa. Márcia Alves',
        coautores: [],
        palavrasChave: ['Saúde mental', 'UX', 'Web'],
        ano: 2025,
        autorId: 'usuario-aluna',
        createdAt: diasAtras(28),
        pdf: null,
    },
    {
        id: 'descarte-certo',
        titulo: 'Descarte Certo: educação ambiental na comunidade',
        tema: 'Sustentabilidade',
        resumo: 'Mapeamento colaborativo de pontos de coleta e campanha digital para estimular o descarte responsável de resíduos eletrônicos.',
        curso: 'Técnico em Meio Ambiente',
        orientador: 'Prof. Paulo Neri',
        coautores: [],
        palavrasChave: ['Reciclagem', 'Comunidade', 'Educação'],
        ano: 2024,
        autorId: 'usuario-aluna',
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

export function novoId() {
    return randomUUID();
}
