import nodemailer from 'nodemailer';

let transportador = null;

function configuracaoEmail() {
    const porta = Number(process.env.SMTP_PORT || 587);

    return {
        host: process.env.SMTP_HOST,
        port: porta,
        secure: process.env.SMTP_SECURE === 'true' || porta === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    };
}

export function emailConfigurado() {
    return Boolean(
        process.env.SMTP_HOST
        && process.env.SMTP_USER
        && process.env.SMTP_PASS
        && process.env.EMAIL_FROM,
    );
}

function obterTransportador() {
    if (!emailConfigurado()) {
        const erro = new Error('O envio de e-mail ainda não foi configurado.');
        erro.code = 'EMAIL_NAO_CONFIGURADO';
        throw erro;
    }

    if (!transportador) {
        transportador = nodemailer.createTransport({
            ...configuracaoEmail(),
            disableFileAccess: true,
            disableUrlAccess: true,
        });
    }

    return transportador;
}

export async function enviarCodigoEmail({ destino, codigo, minutosValidade }) {
    const remetente = process.env.EMAIL_FROM;
    const assunto = 'Código de acesso ao AcervoTCC';
    const texto = [
        'Recebemos uma tentativa de acesso à sua conta no AcervoTCC.',
        `Seu código é: ${codigo}`,
        `Ele expira em ${minutosValidade} minutos e só pode ser utilizado uma vez.`,
        'Se você não tentou entrar, ignore esta mensagem.',
    ].join('\n\n');

    await obterTransportador().sendMail({
        from: remetente,
        to: destino,
        subject: assunto,
        text: texto,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14213d">
                <h1 style="font-size:22px;color:#12377a">Confirme seu acesso</h1>
                <p>Recebemos uma tentativa de acesso à sua conta no AcervoTCC.</p>
                <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1d4ed8">${codigo}</p>
                <p>O código expira em ${minutosValidade} minutos e só pode ser utilizado uma vez.</p>
                <p style="color:#64748b">Se você não tentou entrar, ignore esta mensagem.</p>
            </div>
        `,
    });
}
