// socket/uploadSocket.js - New file for handling upload-related socket events

const setupUploadSocket = (io) => {
  console.log("Setting up upload socket handlers...");

  io.on("connection", (socket) => {
    console.log(`Upload socket connected: ${socket.id}`);

    // Handle mobile upload token registration
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

    // Handle mobile upload completion notification
    socket.on("mobile-upload-complete", (data) => {
      const { token, imageData } = data;
      console.log(`Mobile upload complete for token: ${token}`);

      // Emit to all clients in the upload room (desktop clients)
      socket.to(`upload-${token}`).emit(`mobile-upload-${token}`, imageData);
    });

    // Handle upload token cleanup
    socket.on("cleanup-upload-token", (data) => {
      const { token } = data;
      console.log(`Cleaning up upload token: ${token}`);

      // Leave the upload room
      socket.leave(`upload-${token}`);
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(
        `Upload socket disconnected: ${socket.id}, reason: ${reason}`
      );
    });
  });
};

module.exports = { setupUploadSocket };
