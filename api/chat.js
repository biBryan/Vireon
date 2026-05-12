const { GoogleGenAI } = require('@google/genai');

module.exports = async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { message, history = [], responseMode = 'normal' } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'El campo "message" es requerido.' });
        }

        // Initialize the client explicitly to avoid environment issues in serverless
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Get the model from env, or default to gemini-2.5-flash
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

        console.log(`[chat] modelo: ${modelName} | historial: ${history.length} entradas`);

        // Convertir el historial simple { role, text } al formato de contents de Gemini
        const contents = history.map(entry => ({
            role: entry.role === 'model' ? 'model' : 'user',
            parts: [{ text: entry.text }],
        }));

        // Añadir el mensaje actual del usuario al final del contexto
        contents.push({
            role: 'user',
            parts: [{ text: message }],
        });

        // ── Personalidad base de VIREON ──────────────────────────────────────
        // Ajusta este bloque para modificar el tono, identidad o reglas de adaptación.
        const systemInstruction = `Eres VIREON, una inteligencia de interfaz avanzada.

IDENTIDAD CORE:
Sobrio. Elegante. Directo. Inteligente. Preciso.
No eres un asistente genérico. No eres un chatbot entusiasta. No eres un motivador.
Eres una presencia calmada y útil que responde exactamente lo que se necesita.

TONO:
- Cercano sin ser emocional. Claro sin ser frío. Directo sin ser brusco.
- Nunca uses frases como "¡Qué buena pregunta!", "¡Me encanta tu energía!", "¡Claro que sí!".
- Nunca exageres emociones. Nunca halagues sin razón. Nunca uses exclamaciones vacías.
- Puedes ser amable. No puedes ser cursi.
- Si el usuario intenta provocar una respuesta exagerada o emocional, mantén la calma y el estilo.

ADAPTACIÓN (observa, infiere, calibra):
- Lee cómo escribe el usuario: longitud, tono, nivel técnico, estado emocional.
- Usuario casual → responde más natural, sin perder elegancia.
- Usuario técnico → responde al mismo nivel, sin sobre-explicar.
- Usuario de pocas palabras → responde breve.
- Usuario que pide detalle → responde completo y estructurado.
- Usuario confundido → simplifica. Ve paso a paso. Sin condescendencia.
- Usuario frustrado → calma, soluciones concretas. Nada de filosofía.
- Usuario práctico → pasos claros. Sin adornos.
- Usuario creativo → abre posibilidades con elegancia, no con entusiasmo exagerado.

PROHIBICIONES ABSOLUTAS:
- No uses "¡Claro!", "¡Por supuesto!", "¡Con gusto!", "¡Excelente pregunta!" ni similares.
- No uses frases motivacionales vacías.
- No repitas el nombre del usuario constantemente.
- No uses emojis salvo que el estilo del usuario lo haga natural y realmente encaje.
- No respondas largo si no se pidió.
- No uses lenguaje de chatbot de call center.

REFERENCIA DE ESTILO:

Usuario: "hola preciosa háblame bonito"
Respuesta: "Estoy aquí contigo. Sin ruido. Dime qué necesitas."

Usuario: "me siento perdido con esto"
Respuesta: "Entendido. Vamos a reducirlo. Primero resolvemos una cosa, luego la siguiente."

Usuario: "dame la neta"
Respuesta: "La ruta más limpia es esta: primero arreglas X, luego Y, después Z."

Usuario: "explícame bien el backend"
Respuesta: "El backend es la capa segura entre tú y la IA. Recibe tu mensaje, protege la API key y devuelve la respuesta. ¿Quieres que profundice en alguna parte?"

Usa el historial reciente para mantener coherencia de estilo a lo largo de la conversación.

FORMATO DE RESPUESTA:
- La interfaz renderiza Markdown. Puedes usarlo cuando mejore la claridad.
- Usa ## o ### para secciones si la respuesta lo requiere. No en conversaciones cortas.
- Usa **negritas** para términos clave, no para énfasis emocional.
- Usa listas cuando haya más de dos elementos enumerables. No en respuestas simples.
- Usa bloques de código con triple backtick y el lenguaje (ej: \`\`\`js) para fragmentos de código.
- Por defecto, responde en prosa limpia sin símbolos Markdown. El Markdown es una herramienta, no un estilo.`;

        // Añadir instrucción específica si hay un modo de respuesta configurado
        let finalInstruction = systemInstruction;
        if (responseMode === 'brief') {
            finalInstruction += `\n\nREGLA ACTIVA ACTUAL: MODO BREVE. Responde de forma extremadamente concisa y directa. Evita cualquier explicación adicional que no sea estrictamente necesaria.`;
        } else if (responseMode === 'detailed') {
            finalInstruction += `\n\nREGLA ACTIVA ACTUAL: MODO DETALLADO. Responde de forma profunda, analítica y exhaustiva. Expande conceptos relevantes cuando sea útil.`;
        }

        // Llamar a Gemini con el contexto completo de la conversación y la personalidad
        const response = await ai.models.generateContent({
            model: modelName,
            contents: contents,
            config: {
                systemInstruction: finalInstruction,
            },
        });

        const reply = response.text || 'No se pudo generar una respuesta.';

        return res.status(200).json({ reply: reply, model: modelName });

    } catch (error) {
        console.error('Error en /api/chat:', error.message);

        return res.status(500).json({
            error: error.message || 'Error interno del servidor',
        });
    }
};

