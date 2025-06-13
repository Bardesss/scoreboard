FROM python:3.11-slim
WORKDIR /app
COPY src/ ./src
WORKDIR /app/src
RUN pip install --no-cache-dir -r requirements.txt
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "6060"] 