# main.py
# Este archivo contiene la Cloud Function que se activa al subir un
# archivo a un bucket de Cloud Storage.

import os
import json
from google.cloud import storage, logging

# Configuración inicial
# Instancia de un cliente de Cloud Storage.
storage_client = storage.Client()
# Instancia de un cliente de Cloud Logging.
logging_client = logging.Client()
# Nombre del log para rastrear eventos.
LOG_NAME = "storage_file_processing_log"

def process_file_upload(data, context):
    """
    Procesa un archivo subido a un bucket de Cloud Storage.
    Extrae metadatos del archivo y registra un evento detallado en Cloud Logging.

    Args:
        data (dict): El evento de Cloud Storage, que contiene metadatos del archivo.
        context (google.cloud.functions.Context): Metadatos de la función,
                                                  como el ID del evento.
    """
    try:
        # Extraer información del evento
        bucket_name = data['bucket']
        file_name = data['name']
        event_id = context.event_id

        print(f"Evento recibido. Procesando archivo: gs://{bucket_name}/{file_name}")

        # Obtener los metadatos del archivo
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)

        if not blob.exists():
            # Manejo de error si el archivo no se encuentra (caso improbable pero importante).
            error_message = f"Error: El archivo '{file_name}' no se encontró en el bucket '{bucket_name}'."
            print(error_message)
            # Loguear el error.
            logger = logging_client.logger(LOG_NAME)
            logger.log_struct(
                {
                    "message": error_message,
                    "severity": "ERROR",
                    "bucket": bucket_name,
                    "file": file_name,
                    "eventId": event_id
                }
            )
            return # Terminar la ejecución

        # Obtener metadatos detallados
        metadata = {
            "file_name": blob.name,
            "bucket_name": blob.bucket.name,
            "file_size_bytes": blob.size,
            "content_type": blob.content_type,
            "creation_time": blob.time_created.isoformat(),
            "event_id": event_id
        }

        # Registrar los metadatos y el evento en Cloud Logging
        logger = logging_client.logger(LOG_NAME)
        logger.log_struct(
            {
                "message": "Archivo procesado exitosamente.",
                "severity": "INFO",
                "metadata": metadata,
                "workflow_step": "cloud_function_processing"
            }
        )
        print(f"Metadatos del archivo registrados en Cloud Logging: {json.dumps(metadata, indent=2)}")

    except Exception as e:
        # Manejo robusto de cualquier otra excepción.
        error_message = f"Ocurrió un error inesperado al procesar el archivo '{data.get('name', 'desconocido')}': {e}"
        print(error_message)
        logger = logging_client.logger(LOG_NAME)
        logger.log_struct(
            {
                "message": error_message,
                "severity": "CRITICAL",
                "originalEvent": data,
                "eventId": context.event_id if context else "unknown"
            }
        )
