import { mongoose } from '../config/conexao.js';

const ConversaIdeiaSchema = new mongoose.Schema({
    ideia: { type: mongoose.Schema.Types.ObjectId, ref: 'Ideia', required: true, index: true },
    aluno: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    autorIdeia: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    status: { type: String, enum: ['pendente', 'ativa', 'recusada'], default: 'pendente' },
}, { timestamps: true });

ConversaIdeiaSchema.index({ ideia: 1, aluno: 1 }, { unique: true });

export default mongoose.models.ConversaIdeia
    || mongoose.model('ConversaIdeia', ConversaIdeiaSchema);
