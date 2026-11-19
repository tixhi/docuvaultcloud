package com.docuvault.entity;

public enum UserRole {
    ADMIN("admin"),
    MANAGER("manager"),
    MEMBER("member");

    private final String value;

    UserRole(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static UserRole fromString(String text) {
        if (text == null) return MEMBER;
        for (UserRole role : UserRole.values()) {
            if (role.name().equalsIgnoreCase(text) || role.value.equalsIgnoreCase(text)) {
                return role;
            }
        }
        return MEMBER;
    }
}
