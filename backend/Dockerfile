FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Reseed synthetic data fresh on every container start, then serve.
CMD ["sh", "-c", "python seed_data.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
