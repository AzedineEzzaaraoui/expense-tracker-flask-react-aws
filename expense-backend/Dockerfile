FROM python:3.11-alpine

WORKDIR /app

RUN addgroup -S expense && adduser -S expense -G expense

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chown -R expense:expense /app

USER expense

EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "run:app"]
