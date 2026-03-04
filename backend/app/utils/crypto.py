from cryptography.fernet import Fernet
from app.core.config import settings
import base64

# Ensure key is valid base64url-encoded 32-byte key
# In production, this should be properly managed. 
# For now, we pad or hash the config string to get a valid key.
def get_cipher_suite():
    key = settings.ENCRYPTION_KEY
    # Make sure key is 32 url-safe base64 bytes
    # This is a hack for demo; use a real generated key in prod
    if len(key) < 32:
        key = key.ljust(32, '0')
    if len(key) > 32:
        key = key[:32]
    
    # Fernet requires url-safe base64 encoded key
    key_bytes = base64.urlsafe_b64encode(key.encode())
    return Fernet(key_bytes)

def encrypt(data: str) -> str:
    cipher = get_cipher_suite()
    return cipher.encrypt(data.encode()).decode()

def decrypt(token: str) -> str:
    cipher = get_cipher_suite()
    return cipher.decrypt(token.encode()).decode()

