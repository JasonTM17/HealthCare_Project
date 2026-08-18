package com.healthcare.cms.config;

import com.healthcare.cms.service.CmsChangeFeedRedisSubscriber;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
@EnableConfigurationProperties(CmsRealtimeProperties.class)
@ConditionalOnProperty(prefix = "cms.realtime", name = "distributed-enabled", havingValue = "true")
public class CmsRealtimeConfiguration {

    @Bean
    RedisMessageListenerContainer cmsRedisMessageListenerContainer(
        RedisConnectionFactory connectionFactory,
        CmsRealtimeProperties properties,
        CmsChangeFeedRedisSubscriber subscriber
    ) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(subscriber, new ChannelTopic(properties.getChannel()));
        return container;
    }
}
