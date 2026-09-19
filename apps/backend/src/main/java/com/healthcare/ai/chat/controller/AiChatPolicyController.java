package com.healthcare.ai.chat.controller;

import com.healthcare.ai.chat.dto.ChatContracts.ChatPolicyResponse;
import com.healthcare.ai.chat.service.AiConversationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "AI Health Assistant", description = "Trợ lý trí tuệ nhân tạo y tế phân luồng triệu chứng và tư vấn")
@RestController
@RequestMapping("/api/v1/ai")
@PreAuthorize("hasRole('PATIENT')")
public class AiChatPolicyController {

    private final AiConversationService conversationService;

    public AiChatPolicyController(AiConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @Operation(summary = "Chính sách và hạn mức trò chuyện AI", description = "Lấy quy định an toàn, hạn mức tin nhắn hàng ngày và trạng thái đồng ý điều khoản của người bệnh")
    @GetMapping("/chat-policy")
    public ResponseEntity<ChatPolicyResponse> policy(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(conversationService.policy(principal));
    }
}
