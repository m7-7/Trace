import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';

// MobileNet class names
let MODEL_CLASSES: string[] = [];

// Load model class names
async function loadModelClasses() {
  try {
    const classData = await fs.promises.readFile(
      path.join(process.cwd(), 'server/imagenet_classes.json'), 
      'utf-8'
    );
    MODEL_CLASSES = JSON.parse(classData);
  } catch (err) {
    console.error('Error loading model classes, using fallback', err);
    // Fallback for some common categories
    MODEL_CLASSES = [
      'person', 'coffee', 'cat', 'dog', 'car', 'beach', 'mountain', 
      'sunset', 'food', 'building', 'tree', 'flower', 'water', 
      'sky', 'snow', 'laptop', 'phone', 'city', 'nature'
    ];
  }
}

// Global model reference
let model: tf.GraphModel | null = null;

// Initialize model
export async function initializeModel() {
  try {
    // Load model
    model = await tf.loadGraphModel(
      'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1', 
      { fromTFHub: true }
    );
    
    // Load class names
    await loadModelClasses();
    
    console.log('TensorFlow model loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading TensorFlow model:', error);
    return false;
  }
}

// Process image file and get content tags
export async function analyzeImage(imagePath: string): Promise<string[]> {
  if (!model) {
    try {
      const initialized = await initializeModel();
      if (!initialized) {
        return ['error_loading_model'];
      }
    } catch (error) {
      console.error('Error initializing model:', error);
      return ['error_initializing_model'];
    }
  }
  
  try {
    // Read image file
    const imageBuffer = await fs.promises.readFile(imagePath);
    
    // Decode image
    const tfimage = tf.node.decodeImage(imageBuffer, 3);
    
    // Resize and normalize image
    const resized = tf.image.resizeBilinear(tfimage as tf.Tensor3D, [224, 224]);
    const normalized = resized.div(255.0);
    const batched = normalized.expandDims(0);
    
    // Make prediction
    const predictions = await model!.predict(batched) as tf.Tensor;
    
    // Get top 5 predictions
    const scores = await predictions.data();
    const indices = Array.from(scores)
      .map((score, i) => ({ score, index: i }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ index }) => index);
    
    // Map indices to class names and generate simple tags
    const tags = indices
      .map(index => {
        const className = MODEL_CLASSES[index] || `unknown_${index}`;
        // Extract the main object name from the class name (remove detailed descriptions)
        const simplifiedTag = className.split(',')[0].trim().toLowerCase();
        return simplifiedTag;
      })
      .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
    
    // Clean up tensors
    tfimage.dispose();
    resized.dispose();
    normalized.dispose();
    batched.dispose();
    predictions.dispose();
    
    return tags;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return ['error_analyzing_image'];
  }
}
