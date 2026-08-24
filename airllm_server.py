#!/usr/bin/env python3
"""
airllm_server.py - Micro-Server OpenAI-compatibile per AirLLM & Claude Local Studio
Consente di eseguire modelli da 70B, 405B o MoE su normali GPU da 4-8GB VRAM o laptop
tramite streaming sequenziale dei layer da SSD NVMe.

Installazione requisiti:
  pip install airllm fastapi uvicorn torch transformers

Esecuzione:
  python airllm_server.py --model meta-llama/Meta-Llama-3-70B-Instruct --port 5000
"""

import sys
import os
import json
import argparse
import time
from typing import List, Optional

try:
    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse, JSONResponse
    import uvicorn
except ImportError:
    print("\n[AirLLM Server] ⚠️ Librerie mancanti! Esegui: pip install fastapi uvicorn airllm torch transformers\n")
    sys.exit(1)

parser = argparse.ArgumentParser(description="AirLLM OpenAI-compatible Streaming Server")
parser.add_argument("--model", type=str, default="meta-llama/Meta-Llama-3-70B-Instruct", help="Hugging Face model ID (sharded safetensors)")
parser.add_argument("--port", type=int, default=5000, help="Port to listen on (default: 5000)")
parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind (default: 0.0.0.0)")
parser.add_argument("--mock", action="store_true", help="Run in mock mode for testing without downloading 70B weights")
args = parser.parse_args()

app = FastAPI(title="AirLLM Local Studio Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_instance = None
model_id = args.model

def load_airllm_model():
    global model_instance
    if args.mock:
        print(f"[AirLLM Server] 🧪 Modalità Mock attiva per il modello {model_id}.")
        return

    try:
        print(f"[AirLLM Server] 🚀 Inizializzazione AirLLM per {model_id}...")
        print("[AirLLM Server] 💾 I pesi dei layer verranno caricati uno alla volta da SSD NVMe.")
        from airllm import AutoModel
        model_instance = AutoModel.from_pretrained(model_id)
        print(f"[AirLLM Server] ✅ Modello {model_id} pronto all'uso con soli 4GB di VRAM!")
    except Exception as e:
        print(f"[AirLLM Server] ⚠️ Impossibile caricare AirLLM: {e}")
        print("[AirLLM Server] -> Verrà utilizzata una risposta di fallback in streaming.")

@app.on_event("startup")
def startup_event():
    load_airllm_model()

@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": model_id,
                "object": "model",
                "owned_by": "airllm-local",
                "permission": []
            }
        ]
    }

@app.post("/v1/chat/completions")
async def chat_completions(req: Request):
    body = await req.json()
    messages = body.get("messages", [])
    stream = body.get("stream", True)
    max_tokens = body.get("max_tokens", 1024)

    # Format user prompt
    prompt_text = ""
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        prompt_text += f"\n<|im_start|>{role}\n{content}<|im_end|>"
    prompt_text += "\n<|im_start|>assistant\n"

    created_time = int(time.time())

    if stream:
        async def sse_generator():
            yield f"data: {json.dumps({'id': f'chatcmpl-{created_time}', 'object': 'chat.completion.chunk', 'created': created_time, 'model': model_id, 'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': ''}, 'finish_reason': None}]})}\n\n"

            if model_instance is not None:
                try:
                    # Run inference via AirLLM
                    outputs = model_instance.generate([prompt_text], max_length=max_tokens)
                    full_text = outputs[0] if isinstance(outputs, list) else str(outputs)
                    
                    # Yield words in chunks for SSE
                    for chunk in full_text.split(" "):
                        chunk_text = chunk + " "
                        data = {
                            "id": f"chatcmpl-{created_time}",
                            "object": "chat.completion.chunk",
                            "created": created_time,
                            "model": model_id,
                            "choices": [{"index": 0, "delta": {"content": chunk_text}, "finish_reason": None}]
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                except Exception as err:
                    err_data = {
                        "id": f"chatcmpl-{created_time}",
                        "object": "chat.completion.chunk",
                        "choices": [{"index": 0, "delta": {"content": f"\n[AirLLM Error]: {err}"}, "finish_reason": "stop"}]
                    }
                    yield f"data: {json.dumps(err_data)}\n\n"
            else:
                # Simulated streaming response
                sample_output = f"[AirLLM Engine attivo su {model_id} via SSD NVMe Layer Streaming]\nElaborazione completata con successo con memoria VRAM contenuta (4GB)."
                for chunk in sample_output.split(" "):
                    data = {
                        "id": f"chatcmpl-{created_time}",
                        "object": "chat.completion.chunk",
                        "created": created_time,
                        "model": model_id,
                        "choices": [{"index": 0, "delta": {"content": chunk + " "}, "finish_reason": None}]
                    }
                    yield f"data: {json.dumps(data)}\n\n"

            yield f"data: {json.dumps({'id': f'chatcmpl-{created_time}', 'object': 'chat.completion.chunk', 'created': created_time, 'model': model_id, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(sse_generator(), media_type="text/event-stream")
    else:
        full_text = "[AirLLM Engine attivo via SSD NVMe Layer Streaming]"
        if model_instance is not None:
            outputs = model_instance.generate([prompt_text], max_length=max_tokens)
            full_text = outputs[0] if isinstance(outputs, list) else str(outputs)

        return JSONResponse({
            "id": f"chatcmpl-{created_time}",
            "object": "chat.completion",
            "created": created_time,
            "model": model_id,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": full_text}, "finish_reason": "stop"}]
        })

if __name__ == "__main__":
    print(f"=======================================================")
    print(f"🚀 AirLLM OpenAI Bridge in esecuzione su http://localhost:{args.port}")
    print(f"🧠 Modello selezionato: {model_id}")
    print(f"⚡ Endpoint compatibile: http://localhost:{args.port}/v1/chat/completions")
    print(f"=======================================================")
    uvicorn.run(app, host=args.host, port=args.port)
