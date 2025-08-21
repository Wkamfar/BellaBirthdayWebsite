require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // You might need to `npm install node-fetch` if not already there

const app = express();
const port = 3000; // Or any other port you prefer

// Enable CORS for all origins (for development). In production, restrict this to your frontend's origin.
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large image data

// Endpoint for French Bulldog Generator (Text-to-Image)
app.post('/generate-bulldog', async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY; // Get API key from environment variable
    if (!apiKey) {
        return res.status(500).json({ error: 'Google API key not configured on the server.' });
    }

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

    try {
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google API Error for generate-bulldog:', response.status, errorText);
            return res.status(response.status).json({ error: `API request failed: ${errorText}` });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Proxy server error for generate-bulldog:', error);
        res.status(500).json({ error: 'Proxy server error during image generation.' });
    }
});

// Endpoint for Image Describer and Generator
app.post('/describe-and-generate', async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Google API key not configured on the server.' });
    }

    const { imageData, userPrompt } = req.body; // imageData is the base64 string, userPrompt is the optional user input

    if (!imageData) {
        return res.status(400).json({ error: 'No image data provided.' });
    }

    try {
        // Step 1: Describe the image using Gemini Pro Vision (or gemini-2.5-flash-preview-05-20)
        const describeApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const describePayload = {
            contents: [{
                parts: [
                    { text: "Describe the person in the image in detail but focus on their features and details in a way that could be used to replicate only the person in an image generation model and make sure that it is concise." },
                    { inlineData: { mimeType: "image/png", data: imageData } }
                ]
            }]
        };

        const describeResponse = await fetch(describeApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(describePayload)
        });

        if (!describeResponse.ok) {
            const errorText = await describeResponse.text();
            console.error('Google API Error for image description:', describeResponse.status, errorText);
            return res.status(describeResponse.status).json({ error: `Image description failed: ${errorText}` });
        }

        const describeData = await describeResponse.json();
        let description = describeData.candidates[0].content.parts[0].text;

        if (!description) {
            return res.status(500).json({ error: 'Failed to get description from the image.' });
        }

        // Compose the highly stylized young woman description
        const stylizedWomanDescription = "make sure it is hyperrealistic, two people generated together, the first one is a young woman that has a symmetrical and delicate face with a warm, sun-kissed complexion. Her eyebrows are well-defined, light brown, and slightly arched. Her eyes are large, light blue, and have a wide-set appearance. They are enhanced with a black winged eyeliner, brown eyeshadow on the crease, and long, full eyelashes. Her nose is narrow and straight, with a slightly upturned tip. Her lips are full and have a prominent cupid's bow, covered in a glossy, light brown or nude-pink lipstick. She has high, defined cheekbones with a soft pink blush. Her chin is pointed. Her hair is a warm, light blonde with highlights, styled in a loose wave with a side part. . The second person is ";

        // Incorporate the prompt so the person it describes is doing that thing or in that place
        // The prompt should describe the stylized woman doing the thing or in the place described by the user prompt and/or the image description
        let combinedPrompt = `${stylizedWomanDescription}`;
        if (description && userPrompt) {
            combinedPrompt += ` ${description} the setting is / they are doing: ${userPrompt}`;
        } else if (userPrompt) {
            combinedPrompt += ` She is ${userPrompt}.`;
        } else if (description) {
            combinedPrompt += ` She is ${description}.`;
        }

        // Step 2: Generate a new image using the combined prompt
        const generateApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
        const generatePayload = {
            instances: [{ prompt: combinedPrompt }],
            parameters: { sampleCount: 1 }
        };

        const generateResponse = await fetch(generateApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(generatePayload)
        });

        if (!generateResponse.ok) {
            const errorText = await generateResponse.text();
            console.error('Google API Error for image generation from description:', generateResponse.status, errorText);
            return res.status(generateResponse.status).json({ error: `Image generation failed: ${errorText}` });
        }

        const generateData = await generateResponse.json();
        const generatedImage = generateData.predictions[0].bytesBase64Encoded;

        res.json({ description: combinedPrompt, generatedImage: generatedImage });

    } catch (error) {
        console.error('Proxy server error for describe and generate:', error);
        res.status(500).json({ error: 'Proxy server error during describe and generate process.' });
    }
});

// Serve static files (your index.html, CSS, JS, etc.)
// This assumes your index.html and other frontend assets are in the same directory as server.js
app.use(express.static(__dirname)); 

app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
    console.log('Remember to set your GOOGLE_API_KEY environment variable.');
});
