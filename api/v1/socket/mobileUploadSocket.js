// api/v1/socket/mobileUploadSocket.js - New file for upload socket handling

const setupUploadSocket = (io) => {
  console.log("Setting up upload socket handlers...");

  // Create a separate namespace for uploads that doesn't require authentication
  const uploadNamespace = io.of("/uploads");

  // No authentication middleware for uploads - they use tokens instead
  uploadNamespace.on("connection", (socket) => {
    console.log(`Upload socket connected: ${socket.id}`);

    // Send connection confirmation
    socket.emit("connection-confirmed", {
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    // Handle upload token registration (for QR code uploads)
    socket.on("register-upload-token", (data) => {
      const { token, userId } = data;
      console.log(`Registering upload token: ${token} for user: ${userId}`);

      // Join a room specific to this upload token
      socket.join(`upload-${token}`);

      // Confirm registration
      socket.emit("token-registered", {
        success: true,
        token,
        message: "Upload token registered successfully",
      });
    });

    // Handle upload token cleanup
    socket.on("cleanup-upload-token", (data) => {
      const { token } = data;
      console.log(`Cleaning up upload token: ${token}`);
      socket.leave(`upload-${token}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Upload socket ${socket.id} disconnected: ${reason}`);
    });
  });

  return uploadNamespace;
};

module.exports = { setupUploadSocket };
