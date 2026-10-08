package com.kiyuziyu.api.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Configuration
public class FirebaseConfig {

    private static final String DEFAULT_PROJECT_ID = "kiyuziyu-7ca67";

    @Value("${firebase.project-id:}")
    private String projectId;

    @Value("${firebase.client-email:}")
    private String clientEmail;

    @Value("${firebase.private-key:}")
    private String privateKey;

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public void setClientEmail(String clientEmail) {
        this.clientEmail = clientEmail;
    }

    public void setPrivateKey(String privateKey) {
        this.privateKey = privateKey;
    }

    public String getEffectiveProjectId() {
        return (projectId != null && !projectId.trim().isEmpty()) ? projectId.trim() : DEFAULT_PROJECT_ID;
    }

    @Bean
    public Firestore firestore() throws IOException {
        if (FirebaseApp.getApps().isEmpty()) {
            GoogleCredentials credentials = null;

            if (projectId != null && !projectId.trim().isEmpty() && 
                clientEmail != null && !clientEmail.trim().isEmpty() && 
                privateKey != null && !privateKey.trim().isEmpty()) {
                
                String formattedKey = privateKey.replace("\\n", "\n");
                String jsonCredentials = String.format(
                    "{\"type\": \"service_account\", \"project_id\": \"%s\", \"private_key\": \"%s\", \"client_email\": \"%s\", \"private_key_id\": \"dummy_key_id\", \"client_id\": \"dummy_client_id\"}",
                    getEffectiveProjectId(), formattedKey.replace("\n", "\\n"), clientEmail
                );
                
                InputStream serviceAccount = new ByteArrayInputStream(jsonCredentials.getBytes(StandardCharsets.UTF_8));
                credentials = GoogleCredentials.fromStream(serviceAccount);
            } else {
                // Try to fallback to Google Application Default Credentials
                try {
                    credentials = GoogleCredentials.getApplicationDefault();
                } catch (Exception e) {
                    // Check for local serviceAccountKey.json or service-account.json files if present
                    java.io.File keyFile = new java.io.File("serviceAccountKey.json");
                    if (!keyFile.exists()) {
                        keyFile = new java.io.File("service-account.json");
                    }
                    if (keyFile.exists()) {
                        try (InputStream is = new java.io.FileInputStream(keyFile)) {
                            credentials = GoogleCredentials.fromStream(is);
                        } catch (Exception fileErr) {
                            System.err.println("Could not read local service account file: " + fileErr.getMessage());
                        }
                    }
                }
            }

            if (credentials == null) {
                System.err.println("Warning: Firebase credentials not configured via environment or key file. Initializing local development fallback credentials.");
                credentials = GoogleCredentials.create(
                    new com.google.auth.oauth2.AccessToken("local-dev-token", new java.util.Date(System.currentTimeMillis() + 86400000L))
                );
            }
            
            FirebaseOptions options = FirebaseOptions.builder()
                    .setProjectId(getEffectiveProjectId())
                    .setCredentials(credentials)
                    .build();

            try {
                FirebaseApp.initializeApp(options);
            } catch (Exception e) {
                System.err.println("Error initializing FirebaseApp: " + e.getMessage());
            }
        }

        return FirestoreClient.getFirestore();
    }
}

