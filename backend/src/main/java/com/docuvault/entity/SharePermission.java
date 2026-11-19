package com.docuvault.entity;

public enum SharePermission {
    VIEW("view"),
    COMMENT("comment"),
    EDIT("edit");

    private final String value;

    SharePermission(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static SharePermission fromString(String text) {
        if (text == null) return VIEW;
        for (SharePermission p : SharePermission.values()) {
            if (p.name().equalsIgnoreCase(text) || p.value.equalsIgnoreCase(text)) {
                return p;
            }
        }
        return VIEW;
    }
}
