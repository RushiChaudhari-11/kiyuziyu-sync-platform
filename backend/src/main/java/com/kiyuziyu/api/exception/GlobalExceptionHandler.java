package com.kiyuziyu.api.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("message", "Validation failed: " + ex.getBindingResult().getAllErrors().get(0).getDefaultMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequestException(BadRequestException ex) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("message", ex.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFoundException(NotFoundException ex) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("message", ex.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthorizedException(UnauthorizedException ex) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("message", ex.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, Object>> handleForbiddenException(ForbiddenException ex) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("message", ex.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflictException(ConflictException ex) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("message", ex.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(com.kiyuziyu.api.integration.shopify.ShopifyGraphQLException.class)
    public ResponseEntity<Map<String, Object>> handleShopifyGraphQLException(com.kiyuziyu.api.integration.shopify.ShopifyGraphQLException ex) {
        org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class)
                .error("[ShopifyGraphQLException] Error syncing with Shopify store {}: {}", ex.getStoreDomain(), ex.getMessage());
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("message", "Failed to communicate with Shopify API: " + ex.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_GATEWAY);
    }

    @ExceptionHandler(java.util.concurrent.ExecutionException.class)
    public ResponseEntity<Map<String, Object>> handleExecutionException(java.util.concurrent.ExecutionException ex) {
        Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
        org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class)
                .error("[GlobalExceptionHandler] ExecutionException cause: {}", cause.getMessage(), cause);
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);

        String rawMsg = cause.getMessage() != null ? cause.getMessage() : "";
        if (rawMsg.contains("RESOURCE_EXHAUSTED") || rawMsg.contains("Quota exceeded")) {
            errorResponse.put("message", "Firebase / Google Cloud Firestore daily quota exceeded. Please upgrade to the Blaze plan (pay-as-you-go) in Firebase Console or check Google Cloud Billing status.");
            return new ResponseEntity<>(errorResponse, HttpStatus.TOO_MANY_REQUESTS);
        }

        errorResponse.put("message", rawMsg.isEmpty() ? "Database operation failed" : rawMsg);
        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(io.grpc.StatusRuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleStatusRuntimeException(io.grpc.StatusRuntimeException ex) {
        org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class)
                .error("[GlobalExceptionHandler] StatusRuntimeException: {}", ex.getMessage(), ex);
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);

        if (ex.getStatus().getCode() == io.grpc.Status.Code.RESOURCE_EXHAUSTED || ex.getMessage().contains("Quota exceeded")) {
            errorResponse.put("message", "Firebase / Google Cloud Firestore daily quota exceeded. Please upgrade to the Blaze plan (pay-as-you-go) in Firebase Console or check Google Cloud Billing status.");
            return new ResponseEntity<>(errorResponse, HttpStatus.TOO_MANY_REQUESTS);
        }

        errorResponse.put("message", "Database operation failed: " + ex.getStatus().getDescription());
        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneralException(Exception ex) {
        // Log full detail internally — NEVER expose stack trace or internal message to clients
        org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class)
                .error("[GlobalExceptionHandler] Unhandled exception: {}", ex.getMessage(), ex);
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        String rawMsg = ex.getMessage() != null ? ex.getMessage() : "";
        if (rawMsg.contains("RESOURCE_EXHAUSTED") || rawMsg.contains("Quota exceeded")) {
            errorResponse.put("message", "Firebase / Google Cloud Firestore daily quota exceeded. Please upgrade to the Blaze plan in Firebase Console or check Google Cloud Billing.");
            return new ResponseEntity<>(errorResponse, HttpStatus.TOO_MANY_REQUESTS);
        }
        errorResponse.put("message", rawMsg.isEmpty() ? "An internal error occurred. Please try again." : rawMsg);
        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
