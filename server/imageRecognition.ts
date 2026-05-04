import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';

// MobileNet class names (1001 entries: index 0 = background, 1-1000 = ImageNet classes)
let MODEL_CLASSES: string[] = [];

// Load model class names — tries local file first, then a public CDN, then falls back to a curated list
async function loadModelClasses() {
  const localPath = path.join(process.cwd(), 'server/imagenet_classes.json');

  // 1. Try local file
  try {
    const classData = await fs.promises.readFile(localPath, 'utf-8');
    MODEL_CLASSES = JSON.parse(classData);
    console.log(`Loaded ${MODEL_CLASSES.length} ImageNet classes from local file`);
    return;
  } catch {
    // file not present — fall through
  }

  // 2. Try fetching from a public source (simple 1000-label list)
  try {
    const res = await fetch(
      'https://raw.githubusercontent.com/anishathalye/imagenet-simple-labels/master/imagenet-simple-labels.json',
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const labels: string[] = await res.json();
      // MobileNetV2 TF Hub model outputs 1001 logits: index 0 = background
      MODEL_CLASSES = ['background', ...labels];
      console.log(`Loaded ${MODEL_CLASSES.length} ImageNet classes from CDN`);
      // Cache for next startup
      try {
        await fs.promises.writeFile(localPath, JSON.stringify(MODEL_CLASSES));
      } catch {
        // non-fatal — just skip caching
      }
      return;
    }
  } catch {
    // network error or timeout — fall through
  }

  // 3. Curated fallback covering common photo subjects
  console.warn('Using built-in fallback ImageNet class list (limited accuracy)');
  MODEL_CLASSES = [
    'background', 'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train',
    'truck', 'boat', 'traffic light', 'stop sign', 'bench', 'bird', 'cat', 'dog',
    'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
    'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard',
    'sports ball', 'kite', 'baseball bat', 'skateboard', 'surfboard', 'tennis racket',
    'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana',
    'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'pizza', 'donut', 'cake',
    'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv',
    'laptop', 'mouse', 'keyboard', 'cell phone', 'microwave', 'oven', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'toothbrush',
    'beach', 'mountain', 'sunset', 'forest', 'waterfall', 'desert', 'snow', 'sky',
    'city', 'building', 'flower', 'tree', 'grass', 'river', 'lake', 'ocean',
    'food', 'coffee', 'nature', 'architecture', 'landscape', 'portrait', 'travel',
  ];
}

// Global model reference
let model: tf.GraphModel | null = null;

// Initialize model
export async function initializeModel() {
  try {
    model = await tf.loadGraphModel(
      'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1',
      { fromTFHub: true }
    );

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
    const imageBuffer = await fs.promises.readFile(imagePath);

    const tfimage = tf.node.decodeImage(imageBuffer, 3);
    const resized = tf.image.resizeBilinear(tfimage as tf.Tensor3D, [224, 224]);
    const normalized = resized.div(255.0);
    const batched = normalized.expandDims(0);

    const predictions = await model!.predict(batched) as tf.Tensor;

    // Get top 5 predictions by score
    const scores = await predictions.data();
    const indices = Array.from(scores)
      .map((score, i) => ({ score, index: i }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ index }) => index);

    // Map indices to simplified class-name tags
    const tags = indices
      .map(index => {
        const className = MODEL_CLASSES[index] || `unknown_${index}`;
        return className.split(',')[0].trim().toLowerCase();
      })
      .filter((tag, index, self) => self.indexOf(tag) === index);

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
