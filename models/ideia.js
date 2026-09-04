import { mongoose } from '../config/conexao.js';

const IdeiaSchema = new mongoose.Schema({
    titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
    tema: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    descricao: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
    curso: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    dificuldade: {
        type: String,
        enum: ['Iniciante', 'Intermediária', 'Avançada'],
        default: 'Intermediária',
    },
    status: {
        type: String,
        enum: ['Disponível', 'Em desenvolvimento', 'Usada', 'Concluída'],
        default: 'Disponível',
    },
    origem: { type: String, enum: ['interna', 'externa'], default: 'interna', index: true },
    moderacao: {
        type: String,
        enum: ['pendente', 'aprovada', 'rejeitada'],
        default: 'aprovada',
        index: true,
    },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    interessados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
    reservadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null, index: true },
    tccRelacionado: { type: mongoose.Schema.Types.ObjectId, ref: 'Tcc', default: null },
}, { timestamps: true });

export default mongoose.models.Ideia || mongoose.model('Ideia', IdeiaSchema);
