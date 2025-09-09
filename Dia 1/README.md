# Reto del Día 1: Configuración Avanzada de la Infraestructura de GCP

## Visión General

Este documento detalla la solución propuesta para el reto de infraestructura, centrado en la creación de un entorno seguro y automatizado en Google Cloud Platform (GCP). La arquitectura implementada utiliza Cloud Storage, Cloud Functions y Cloud Logging para procesar y registrar metadatos de archivos de manera eficiente y escalable.

## Flujo de Trabajo

El flujo de trabajo es simple pero robusto:

1. Un usuario o un servicio sube un archivo a un bucket de Cloud Storage
2. El evento de carga de archivo (`google.storage.object.finalize`) activa una Cloud Function
3. La Cloud Function se ejecuta, extrae metadatos clave del archivo (nombre, tamaño, tipo)
4. La función registra los metadatos y el estado del evento en Cloud Logging

Este diseño asegura una trazabilidad completa de cada archivo subido, facilitando la auditoría y la depuración.

## Requisitos Previos

- Cuenta de GCP activa con permisos para crear proyectos
- gcloud CLI instalado y configurado
- Python 3.8+ instalado localmente
- Git para clonar el repositorio

## Instrucciones Paso a Paso

### 1. Creación y Configuración del Proyecto

**Crear el proyecto:**

```bash
gcloud projects create reto-dia-1-infra --name="Reto Dia 1 Infra"
gcloud config set project reto-dia-1-infra
```

**Habilitar APIs:**

```bash
gcloud services enable storage.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable pubsub.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable cloudbuild.googleapis.com # Opcional
```

**Configurar IAM:**

Crea una cuenta de servicio de prueba con privilegios mínimos para las tareas de automatización.

```bash
gcloud iam service-accounts create service-account-test --display-name="Service Account Test"

# Asignar roles mínimos para probar la funcionalidad
gcloud projects add-iam-policy-binding reto-dia-1-infra \
  --member="serviceAccount:service-account-test@reto-dia-1-infra.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding reto-dia-1-infra \
  --member="serviceAccount:service-account-test@reto-dia-1-infra.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

Estos permisos permiten a la cuenta de servicio leer objetos del bucket y escribir logs.

### 2. Diseño de Almacenamiento y Automatización

**Crear un bucket en Cloud Storage:**

```bash
gsutil mb -p reto-dia-1-infra -l us-central1 gs://mi-bucket-de-datos-reto-dia-1
```

**Configurar Reglas de Ciclo de Vida:**

Crea un archivo `lifecycle.json` con la política deseada. Por ejemplo, para eliminar objetos después de 30 días:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 30 }
      }
    ]
  }
}
```

Aplica la política al bucket:

```bash
gsutil lifecycle set lifecycle.json gs://mi-bucket-de-datos-reto-dia-1
```

**Implementar la Cloud Function:**

El código está en el archivo `main.py` de este repositorio. Este archivo ya tiene los comentarios detallados. El archivo `requirements.txt` debe contener las dependencias necesarias:

```
google-cloud-storage
google-cloud-logging
```

**Desplegar la Cloud Function:**

```bash
gcloud functions deploy process_file_upload \
  --runtime python311 \
  --entry-point process_file_upload \
  --source . \
  --trigger-bucket mi-bucket-de-datos-reto-dia-1
```

### 3. Pruebas y Documentación

**Pruebas Unitarias:**

Las pruebas unitarias para la Cloud Function se encuentran en el archivo `test_function.py`. Para ejecutarlas localmente:

```bash
python -m unittest test_function.py
```

**Documentación:**

Este `README.md` sirve como documentación detallada del proceso.

## Decisiones Técnicas

**Lenguaje:** Se eligió Python por su excelente soporte para el ecosistema de GCP, la facilidad de manejo de librerías y su legibilidad para tareas de scripting y automatización.

**Manejo de Errores:** Se implementaron bloques try-except para capturar excepciones inesperadas. El logging se utiliza para distinguir entre mensajes informativos (INFO), errores de lógica (ERROR) y fallos críticos (CRITICAL).

**Logging Estructurado:** El uso de `log_struct` en Cloud Logging permite registrar datos como JSON, lo que facilita la búsqueda y el análisis de eventos a gran escala.

---

> **Nota:** Asegúrate de reemplazar "mi-bucket-de-datos-reto-dia-1" con un nombre único para tu bucket, ya que los nombres de los buckets en GCP deben ser globalmente únicos.