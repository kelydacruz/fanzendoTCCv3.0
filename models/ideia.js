import { mongoose } from '../config/conexao.js';

const IdeiaSchema = new mongoose.Schema({
    titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
    tema: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    descricao: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
    curso: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    status: {
        type: String,
        enum: ['Disponível', 'Em desenvolvimento', 'Concluída'],
        default: 'Disponível',
    },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
}, { timestamps: true });

export default mongoose.models.Ideia || mongoose.model('Ideia', IdeiaSchema);
