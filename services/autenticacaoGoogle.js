import { OAuth2Client } from 'google-auth-library';

let clienteGoogle = null;

function obterClienteGoogle() {
    if (!process.env.GOOGLE_CLIENT_ID) {
        const erro = new Error('O login com Google ainda não foi configurado.');
        erro.code = 'GOOGLE_NAO_CONFIGURADO';
        throw erro;
    }

    if (!clienteGoogle) clienteGoogle = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    return clienteGoogle;
}

export async function verificarCredencialGoogle(credencial, nonceEsperado) {
    if (!credencial || !nonceEsperado) throw new Error('Credencial do Google não informada.');

    const ticket = await obterClienteGoogle().verifyIdToken({
        idToken: credencial,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const dados = ticket.getPayload();

    if (!dados?.sub
        || !dados.email
        || dados.email_verified !== true
        || dados.nonce !== nonceEsperado) {
        throw new Error('Não foi possível confirmar este e-mail com o Google.');
    }

    return {
        googleId: dados.sub,
        email: dados.email.toLowerCase(),
        nome: dados.name || dados.email.split('@')[0],
    };
}
