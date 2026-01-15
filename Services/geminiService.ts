
import { GoogleGenAI, Type } from "@google/genai";

export async function analyzeProductImage(base64Image: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = "Analyze this photo of a retail product. Identify: 1. Item name 2. Size from labels 3. Price if a tag is visible 4. A logical category (e.g., Calzado, Remeras, Pantalones, Accesorios). Return JSON.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Generic name of the product" },
            size: { type: Type.STRING, description: "Detected size or 'N/A'" },
            price: { type: Type.NUMBER, description: "Detected price as number, or 0 if not found" },
            category: { type: Type.STRING, description: "Detected category (Calzado, Remeras, etc.)" }
          },
          required: ["name", "size", "price", "category"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Error analyzing image:", error);
    return null;
  }
}
