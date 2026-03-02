const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

async function listAllModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) {
            console.error('❌ API Error:', data.error);
        } else {
            console.log('✅ Available Models:');
            data.models?.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
            if (!data.models || data.models.length === 0) {
                console.log('⚠️ No models found for this key.');
            }
        }
    } catch (err) {
        console.error('❌ Fetch Error:', err.message);
    }
}

listAllModels();
