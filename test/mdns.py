import socket
import sys
import time

# Dependency Check
try:
    from zeroconf import IPVersion, ServiceInfo, Zeroconf
except ImportError:
    print("Error: 'zeroconf' library is missing.")
    print("Please run: pip install zeroconf")
    sys.exit(1)

def get_ip():
    """Detect the current local IP address connecting to the outside world."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    set_timeout = False
    try:
        # Connect to a public DNS server to determine the outgoing interface IP
        s.connect(('8.8.8.8', 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def publish_mdns():
    host_ip = get_ip()
    
    # Configuration
    # We want to be accessible via http://share.local:5173
    hostname = "share.local."  # Must end with a dot
    service_type = "_http._tcp.local."
    service_name = "ScreenShare._http._tcp.local."
    port = 5173 # Vite Frontend Port
    
    print("-" * 50)
    print(f"[*] Starting mDNS Publisher for 'share.local'")
    print(f"[*] Detected Local IP: {host_ip}")
    print(f"[*] Target URL: http://share.local:{port}")
    print("-" * 50)

    try:
        host_ip_bytes = socket.inet_aton(host_ip)
    except socket.error:
        print("Error: Could not convert IP address.")
        sys.exit(1)

    # create service info
    # addresses: List of IP addresses as bytes
    # port: Port number
    # server: The hostname (share.local.)
    info = ServiceInfo(
        service_type,
        service_name,
        addresses=[host_ip_bytes],
        port=port,
        server=hostname,
        properties={'desc': 'ScreenShare Local Dev'},
    )

    zeroconf = Zeroconf(ip_version=IPVersion.V4Only)

    print(f"[*] Registering service [{service_name}]...")
    try:
        zeroconf.register_service(info)
        print("[+] Service Successfully Registered.")
        print("[*] Press Ctrl+C to stop broadcasting.")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[*] Stopping...")
    except Exception as e:
        print(f"[!] Error: {e}")
    finally:
        print("[-] Unregistering service...")
        zeroconf.unregister_service(info)
        zeroconf.close()
        print("[-] Done.")

if __name__ == '__main__':
    publish_mdns()
