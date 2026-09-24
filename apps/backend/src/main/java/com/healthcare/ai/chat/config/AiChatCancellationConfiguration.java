package com.healthcare.ai.chat.config;

import com.healthcare.ai.chat.service.ChatRequestCancellationRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
public class AiChatCancellationConfiguration {

    @Bean
    RedisMessageListenerContainer aiChatCancellationMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            ChatRequestCancellationRegistry cancellationRegistry) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.setRecoveryInterval(1_000);
        container.addMessageListener(cancellationRegistry, new ChannelTopic(ChatRequestCancellationRegistry.CHANNEL));
        return container;
    }
}
