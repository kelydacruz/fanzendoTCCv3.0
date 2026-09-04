import { mongoose } from '../config/conexao.js';

const MensagemIdeiaSchema = new mongoose.Schema({
    conversa: { type: mongoose.Schema.Types.ObjectId, ref: 'ConversaIdeia', required: true, index: true },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    texto: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    lida: { type: Boolean, default: false },
}, { timestamps: true });

MensagemIdeiaSchema.index({ conversa: 1, createdAt: 1 });

export default mongoose.models.MensagemIdeia
    || mongoose.model('MensagemIdeia', MensagemIdeiaSchema);
