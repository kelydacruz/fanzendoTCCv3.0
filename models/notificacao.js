import { mongoose } from '../config/conexao.js';

const NotificacaoSchema = new mongoose.Schema({
    destinatario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    remetente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    tipo: {
        type: String,
        enum: [
            'tcc_recebido', 'correcao_solicitada', 'tcc_aprovado', 'comentario', 'sistema',
            'ideia_interesse', 'ideia_reservada', 'ideia_liberada', 'ideia_usada',
            'contato_solicitado', 'contato_aceito', 'mensagem',
        ],
        required: true,
    },
    mensagem: { type: String, required: true, trim: true, maxlength: 300 },
    link: { type: String, required: true, maxlength: 200 },
    lida: { type: Boolean, default: false, index: true },
}, { timestamps: true });

NotificacaoSchema.index({ destinatario: 1, createdAt: -1 });

export default mongoose.models.Notificacao
    || mongoose.model('Notificacao', NotificacaoSchema);
