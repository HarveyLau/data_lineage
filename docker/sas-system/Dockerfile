FROM alpine:3.20

# Alpine-based build avoids apt repo flakiness on ubuntu-ports.
RUN apk add --no-cache openssh bash shadow sudo && \
    adduser -D -s /bin/sh sasuser && \
    echo "sasuser:sasuser123" | chpasswd && \
    ssh-keygen -A && \
    mkdir -p /var/data/incoming /var/reports /var/scripts && \
    chown -R sasuser:sasuser /var/data /var/reports /var/scripts && \
    sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    echo "PermitRootLogin no" >> /etc/ssh/sshd_config

# Generate sample CSV file
RUN printf "trans_id,customer_id,amount,date\n1,101,1500.50,2024-01-01\n2,102,2500.75,2024-01-01\n3,103,800.25,2024-01-01\n4,101,3200.00,2024-01-01\n5,104,950.50,2024-01-01\n" > /var/data/incoming/transactions_20240101.csv && \
    chown sasuser:sasuser /var/data/incoming/transactions_20240101.csv

EXPOSE 22

CMD ["/usr/sbin/sshd","-D","-e"]
