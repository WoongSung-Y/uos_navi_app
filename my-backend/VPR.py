import sys
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import os
import json

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

infer_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

def load_model(model_path, device):
    checkpoint = torch.load(model_path, map_location=device)
    num_classes = checkpoint['num_classes']
    state_dict = checkpoint['model_state']

    model = models.resnet18(weights=None)
    in_feat = model.fc.in_features
    model.fc = nn.Linear(in_feat, num_classes)

    model.load_state_dict(state_dict, strict=True)
    model.eval()
    model.to(device)

    return model, num_classes

print("[🚀 Python started - loading models...]", flush=True)
MODEL_1, NUM_1 = load_model("model_1.pth", DEVICE)
MODEL_6, NUM_6 = load_model("model_6.pth", DEVICE)
print("[✅ Model loaded and ready]", flush=True)

# 기준 기압과 층 저장
baseline_pressure = None
baseline_floor = None

def predict_tensor(model, tensor):
    with torch.no_grad():
        output = model(tensor)
        pred_idx = output.argmax(dim=1).item()
    return pred_idx

def analyze_image_file(img_path, pressure):
    if pressure <= 1010:
        model = MODEL_1
        model_num = 1
        num_classes = NUM_1
    else:
        model = MODEL_6
        model_num = 6
        num_classes = NUM_6

    image = Image.open(img_path).convert("RGB")
    tensor = infer_transform(image).unsqueeze(0).to(DEVICE)
    pred_idx = predict_tensor(model, tensor)

    return {
        "model": model_num,
        "pred_class_idx": pred_idx,
        "num_classes": num_classes
    }

# 🔁 요청 대기 루프
while True:
    line = sys.stdin.readline()
    if not line:
        break

    try:
        data = json.loads(line)
        img_path = data['image']
        pressure = float(data['pressure'])
        reset = data.get('reset', False)

        if reset:
            baseline_pressure = pressure
            baseline_floor = int(data.get('current_floor', 1))  # 기본값은 1층
            print(f"[🔄 기준 설정됨] 기압: {baseline_pressure:.2f} hPa, 층: {baseline_floor}", flush=True)

        floor_diff = round((baseline_pressure - pressure) / 0.4) if baseline_pressure is not None else 0
        predicted_floor = baseline_floor + floor_diff if baseline_floor is not None else None

        result = analyze_image_file(img_path, pressure)
        result['baseline_pressure'] = baseline_pressure
        result['baseline_floor'] = baseline_floor
        result['predicted_floor'] = predicted_floor
        result['floor_difference'] = floor_diff

        print("__RESULT__" + json.dumps(result), flush=True)

        if os.path.exists(img_path):
            os.remove(img_path)

    except Exception as e:
        print(f"[❌ 처리 실패]: {e}", file=sys.stderr, flush=True)
