import { mongoose } from '../config/conexao.js';

const ComentarioSchema = new mongoose.Schema({
    texto: { type: String, required: true, trim: true, maxlength: 500 },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    alvoTipo: { type: String, enum: ['Tcc', 'Ideia'], required: true },
    alvo: { type: mongoose.Schema.Types.ObjectId, refPath: 'alvoTipo', required: true },
}, { timestamps: true });

export default mongoose.models.Comentario || mongoose.model('Comentario', ComentarioSchema);
