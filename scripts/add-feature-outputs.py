"""Adds a 1280-value "features" output to both pretrained models without changing
their weights or their existing outputs. EcoSort uses these features to match
new pictures against items the user has tagged (Teach it).

Usage: python3 scripts/add-feature-outputs.py
"""
import onnx
from onnx import helper, TensorProto

def add(path, tensor_name, out_name="features"):
    m = onnx.load(path)
    if any(o.name == out_name for o in m.graph.output):
        print(f"{path}: already has '{out_name}'")
        return
    m.graph.node.append(helper.make_node("Identity", [tensor_name], [out_name], name="ecosort_features"))
    m.graph.output.append(helper.make_tensor_value_info(out_name, TensorProto.FLOAT, ["batch", 1280]))
    onnx.checker.check_model(m)
    onnx.save(m, path)
    print(f"{path}: added '{out_name}' from {tensor_name}")

add("public/models/object/mobilenetv2-12.onnx", "472")
add("public/models/waste/smart_waste_mobilenetv2.onnx", "smart_waste_mobilenetv2_1/global_average_pooling_1/Mean_Squeeze__654:0")
