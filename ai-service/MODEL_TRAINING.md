# AI Model Training Guide
# Smart AI Engineering Platform - SPKBG

## Dataset Structure

```
dataset/
├── images/
│   ├── train/
│   │   ├── image1.jpg
│   │   ├── image2.jpg
│   └── val/
│       ├── image3.jpg
│       ├── image4.jpg
└── labels/
    ├── train/
    │   ├── image1.txt
    │   ├── image2.txt
    └── val/
        ├── image3.txt
        ├── image4.txt
```

## Label Format (YOLO)
Each .txt file contains:
```
<class_id> <x_center> <y_center> <width> <height>
```

Example (0 = crack):
```
0 0.5 0.5 0.3 0.1
0 0.2 0.7 0.4 0.2
```

## Training Script

```python
from ultralytics import YOLO

# Load pretrained model or create new
model = YOLO('yolov8n.pt')  # or yolov8s.pt, yolov8m.pt, yolov8l.pt

# Train
results = model.train(
    data='data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    patience=20,
    device=0,  # GPU
    project='crack-detection',
    name='v1'
)

# Export to ONNX (optional)
model.export(format='onnx')
```

## data.yaml

```yaml
path: ./dataset
train: images/train
val: images/val

names:
  0: crack
```

## Model Download

Place your trained model at:
```
ai-service/model/best.pt
```

## Inference Test

```bash
cd ai-service
python -c "from main import model; print('Model loaded:', model is not None)"
```
