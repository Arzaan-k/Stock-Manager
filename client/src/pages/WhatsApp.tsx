import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Send,
  Phone,
  Settings,
  BarChart3,
  Image,
  CheckCircle,
  AlertCircle,
  Clock,
  Bot,
  Smartphone,
} from "lucide-react";

interface WhatsAppMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: string;
  imageUrl?: string;
  status?: "sent" | "delivered" | "read";
}

export default function WhatsApp() {
  const [newMessage, setNewMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+1 (555) 123-4567");
  const [aiModel, setAiModel] = useState("clip-ocr-v2");
  const [autoNotifications, setAutoNotifications] = useState(true);
  const { toast } = useToast();

  // Mock messages - in production this would come from API
  const [messages] = useState<WhatsAppMessage[]>([
    {
      id: "1",
      type: "user",
      content: "I just received 50 units of brake pads",
      timestamp: "2 hours ago",
      imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=120",
      status: "read",
    },
    {
      id: "2",
      type: "ai",
      content: "🔍 I detected: Honda Civic Brake Pads (SKU: BRK-HND-002). Would you like to:\n1️⃣ Add to inventory\n2️⃣ Mark as used for order",
      timestamp: "2 hours ago",
      status: "delivered",
    },
    {
      id: "3",
      type: "user",
      content: "Add to inventory - Warehouse North",
      timestamp: "2 hours ago",
      status: "read",
    },
    {
      id: "4",
      type: "ai",
      content: "✅ Successfully added 50 units of Honda Civic Brake Pads to Warehouse North inventory. Current stock: 62 units available.",
      timestamp: "2 hours ago",
      status: "delivered",
    },
  ]);

  // Mock analytics data
  const analyticsData = {
    imagesProcessed: 47,
    stockUpdates: 23,
    ordersCreated: 8,
    accuracy: 94.2,
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    // In production, this would send message via API
    toast({
      title: "Message sent",
      description: "Your message has been sent to the WhatsApp AI assistant.",
    });
    
    setNewMessage("");
  };

  const handleConfigurationSave = () => {
    toast({
      title: "Configuration saved",
      description: "WhatsApp AI settings have been updated successfully.",
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chat Interface */}
        <Card className="lg:col-span-1">
          <CardHeader className="bg-green-50 dark:bg-green-950/20">
            <CardTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">WhatsApp AI Assistant</h3>
                <p className="text-sm text-muted-foreground">Inventory updates via photo recognition</p>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {/* Messages */}
            <div className="h-96 p-4 space-y-4 overflow-y-auto bg-muted/20">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.id}`}
                >
                  <div className={`max-w-xs lg:max-w-sm ${message.type === "user" ? "order-1" : "order-2"}`}>
                    <div
                      className={`p-3 rounded-lg ${
                        message.type === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border"
                      }`}
                    >
                      {message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt="Shared image"
                          className="mb-2 rounded-lg max-w-full h-auto"
                        />
                      )}
                      <p className="text-sm whitespace-pre-line" data-testid={`message-content-${message.id}`}>
                        {message.content}
                      </p>
                      {message.status && (
                        <div className="flex items-center justify-end mt-1 space-x-1">
                          <span className="text-xs opacity-70">{message.timestamp}</span>
                          {message.status === "read" && <CheckCircle className="w-3 h-3 opacity-70" />}
                          {message.status === "delivered" && <CheckCircle className="w-3 h-3 opacity-50" />}
                          {message.status === "sent" && <Clock className="w-3 h-3 opacity-50" />}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === "user" ? "bg-muted ml-3 order-2" : "bg-primary/10 mr-3 order-1"
                  }`}>
                    {message.type === "user" ? (
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Bot className="w-4 h-4 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-background">
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1"
                  data-testid="input-whatsapp-message"
                />
                <Button onClick={handleSendMessage} size="sm" data-testid="button-send-message">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Configuration & Stats */}
        <div className="space-y-6">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>AI Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="phone-number">WhatsApp Number</Label>
                <Input
                  id="phone-number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  data-testid="input-phone-number"
                />
              </div>

              <div>
                <Label htmlFor="ai-model">AI Model</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger data-testid="select-ai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clip-ocr-v2">CLIP + OCR v2.1</SelectItem>
                    <SelectItem value="gpt-4-vision">GPT-4 Vision</SelectItem>
                    <SelectItem value="custom-model">Custom Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-notifications">Auto-notifications</Label>
                  <p className="text-sm text-muted-foreground">Send low stock alerts automatically</p>
                </div>
                <Switch
                  id="auto-notifications"
                  checked={autoNotifications}
                  onCheckedChange={setAutoNotifications}
                  data-testid="switch-auto-notifications"
                />
              </div>

              <Button onClick={handleConfigurationSave} className="w-full" data-testid="button-save-config">
                Save Configuration
              </Button>
            </CardContent>
          </Card>

          {/* Today's Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Today's Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Image className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Images Processed</span>
                </div>
                <Badge variant="secondary" data-testid="badge-images-processed">
                  {analyticsData.imagesProcessed}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Stock Updates</span>
                </div>
                <Badge variant="secondary" data-testid="badge-stock-updates">
                  {analyticsData.stockUpdates}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Orders Created</span>
                </div>
                <Badge variant="secondary" data-testid="badge-orders-created">
                  {analyticsData.ordersCreated}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Recognition Accuracy</span>
                <Badge variant="default" data-testid="badge-accuracy">
                  {analyticsData.accuracy}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" data-testid="button-test-integration">
                <Phone className="w-4 h-4 mr-2" />
                Test Integration
              </Button>
              
              <Button variant="outline" className="w-full justify-start" data-testid="button-view-logs">
                <Settings className="w-4 h-4 mr-2" />
                View WhatsApp Logs
              </Button>
              
              <Button variant="outline" className="w-full justify-start" data-testid="button-send-test-alert">
                <AlertCircle className="w-4 h-4 mr-2" />
                Send Test Alert
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <p className="font-medium text-foreground">WhatsApp API</p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <p className="font-medium text-foreground">AI Model</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <p className="font-medium text-foreground">Webhook</p>
                <p className="text-sm text-muted-foreground">Listening</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
