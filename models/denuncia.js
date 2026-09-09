import { mongoose } from '../config/conexao.js';
const schema = new mongoose.Schema({
    mensagem: { type: String, required: true },
    conversa: { type: String, required: true },
    denunciante: { type: String, required: true },
    autor: { type: String, required: true },
    nomeAutor: String,
    texto: { type: String, maxlength: 1000, required: true },
    motivo: { type: String, minlength: 5, maxlength: 500, required: true },
    status: { type: String, enum: ['pendente', 'analisada'], default: 'pendente' },
    resposta: { type: String, maxlength: 250 },
    administrador: String,
}, { timestamps: true });
schema.index({ mensagem: 1, denunciante: 1 }, { unique: true });
export default mongoose.models.Denuncia || mongoose.model('Denuncia', schema);
