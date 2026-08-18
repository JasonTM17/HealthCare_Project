package com.healthcare.cms.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "cms.realtime")
public class CmsRealtimeProperties {

    private boolean distributedEnabled;
    private String channel = "healthcare:cms:changes";
    private String instanceId = "local";

    public boolean isDistributedEnabled() {
        return distributedEnabled;
    }

    public void setDistributedEnabled(boolean distributedEnabled) {
        this.distributedEnabled = distributedEnabled;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    public String getInstanceId() {
        return instanceId;
    }

    public void setInstanceId(String instanceId) {
        this.instanceId = instanceId;
    }
}
