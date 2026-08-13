FROM mcr.microsoft.com/devcontainers/javascript-node:4-24-trixie

# # Create the 'sail' user with its own home directory and passwordless sudo.
# ARG USERNAME=sail
# ARG USER_UID=1000
# ARG USER_GID=$USER_UID

# RUN groupadd --gid $USER_GID $USERNAME \
#     && useradd --uid $USER_UID --gid $USER_GID --create-home --shell /bin/bash $USERNAME \
#     && echo "$USERNAME ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
#     && chmod 0440 /etc/sudoers.d/$USERNAME
