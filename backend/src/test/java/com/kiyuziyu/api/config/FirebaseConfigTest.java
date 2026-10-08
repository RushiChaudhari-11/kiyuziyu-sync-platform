package com.kiyuziyu.api.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FirebaseConfigTest {

    private FirebaseConfig firebaseConfig;

    @BeforeEach
    void setUp() {
        firebaseConfig = new FirebaseConfig();
    }

    @Test
    void getEffectiveProjectId_ExplicitProjectId_ReturnsConfiguredValue() {
        firebaseConfig.setProjectId("custom-firebase-project");
        assertEquals("custom-firebase-project", firebaseConfig.getEffectiveProjectId());
    }

    @Test
    void getEffectiveProjectId_ProductionProjectId_ReturnsKiyuziyu7ca67() {
        firebaseConfig.setProjectId("kiyuziyu-7ca67");
        assertEquals("kiyuziyu-7ca67", firebaseConfig.getEffectiveProjectId());
    }

    @Test
    void getEffectiveProjectId_NullOrBlankProjectId_ReturnsFallbackKiyuziyu7ca67() {
        firebaseConfig.setProjectId(null);
        assertEquals("kiyuziyu-7ca67", firebaseConfig.getEffectiveProjectId());

        firebaseConfig.setProjectId("   ");
        assertEquals("kiyuziyu-7ca67", firebaseConfig.getEffectiveProjectId());
    }

    @Test
    void getEffectiveProjectId_NeverReturnsOldJewelleryWholesaleProjectId() {
        firebaseConfig.setProjectId(null);
        assertNotEquals("jewellerywholesale-2e57c", firebaseConfig.getEffectiveProjectId());

        firebaseConfig.setProjectId("kiyuziyu-7ca67");
        assertNotEquals("jewellerywholesale-2e57c", firebaseConfig.getEffectiveProjectId());
    }
}
