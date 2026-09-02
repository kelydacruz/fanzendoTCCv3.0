import { mongoose } from '../config/conexao.js';

const AreaAtuacaoSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 100 },
    ativo: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.AreaAtuacao
    || mongoose.model('AreaAtuacao', AreaAtuacaoSchema);
