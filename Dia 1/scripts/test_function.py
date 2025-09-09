# test_function.py
# Este archivo contiene pruebas unitarias para la Cloud Function 'process_file_upload'.
# Se utiliza el módulo 'unittest' para simular los eventos y verificar el comportamiento.

import unittest
from unittest.mock import MagicMock, patch
from main import process_file_upload

class TestCloudFunction(unittest.TestCase):

    @patch('main.logging_client')
    @patch('main.storage_client')
    def test_successful_file_upload(self, mock_storage_client, mock_logging_client):
        """
        Prueba el flujo exitoso cuando se sube un archivo.
        Verifica que se llame al método de logging con la información correcta.
        """
        # Configurar los mocks para simular el comportamiento de las APIs.
        mock_bucket = MagicMock()
        mock_blob = MagicMock()

        # Configurar el blob para simular un archivo existente con metadatos.
        mock_blob.exists.return_value = True
        mock_blob.name = 'test-file.txt'
        mock_blob.size = 12345
        mock_blob.content_type = 'text/plain'
        mock_blob.time_created.isoformat.return_value = '2023-01-01T12:00:00Z'
        mock_bucket.blob.return_value = mock_blob
        mock_storage_client.bucket.return_value = mock_bucket

        # Simular los datos del evento y el contexto.
        event_data = {
            'bucket': 'test-bucket',
            'name': 'test-file.txt'
        }
        event_context = MagicMock()
        event_context.event_id = '12345-abcde'

        # Ejecutar la función
        process_file_upload(event_data, event_context)

        # Afirmaciones para verificar el comportamiento
        # 1. Asegurar que se haya llamado al cliente de almacenamiento para obtener el bucket y el blob.
        mock_storage_client.bucket.assert_called_with('test-bucket')
        mock_bucket.blob.assert_called_with('test-file.txt')
        
        # 2. Asegurar que se haya llamado al cliente de logging para registrar el evento.
        mock_logging_client.logger.assert_called_with('storage_file_processing_log')
        mock_logging_client.logger().log_struct.assert_called_once()
        
        # 3. Validar el contenido del log, asegurando que la severidad sea 'INFO'.
        logged_data = mock_logging_client.logger().log_struct.call_args[0][0]
        self.assertEqual(logged_data['severity'], 'INFO')
        self.assertEqual(logged_data['metadata']['file_name'], 'test-file.txt')

    @patch('main.logging_client')
    @patch('main.storage_client')
    def test_file_not_found(self, mock_storage_client, mock_logging_client):
        """
        Prueba el manejo de errores cuando un archivo no existe.
        Verifica que se llame al método de logging con la severidad 'ERROR'.
        """
        # Configurar los mocks para simular un archivo no existente.
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False # Simula que el archivo no existe.
        mock_bucket.blob.return_value = mock_blob
        mock_storage_client.bucket.return_value = mock_bucket

        # Simular los datos del evento y el contexto.
        event_data = {
            'bucket': 'test-bucket',
            'name': 'non-existent-file.txt'
        }
        event_context = MagicMock()
        event_context.event_id = '67890-fghij'

        # Ejecutar la función
        process_file_upload(event_data, event_context)

        # Afirmaciones para verificar el manejo de errores
        # 1. Asegurar que el método de logging se haya llamado una vez.
        mock_logging_client.logger().log_struct.assert_called_once()

        # 2. Validar el contenido del log, asegurando que la severidad sea 'ERROR'.
        logged_data = mock_logging_client.logger().log_struct.call_args[0][0]
        self.assertEqual(logged_data['severity'], 'ERROR')
        self.assertIn('no se encontró', logged_data['message'])

if __name__ == '__main__':
    unittest.main()
