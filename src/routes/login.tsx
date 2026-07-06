import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandLogo } from "@/components/brand-logo";
import { PwaInstallButton } from "@/components/pwa-install-prompt";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isConfigured, loading, signInWithPassword, signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.navigate({ to: "/" });
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <FullScreenMessage text="Carregando sessão..." />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute right-4 top-4 z-10">
        <PwaInstallButton />
      </div>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-4 py-12 md:px-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="max-w-2xl">
          <div className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-muted-foreground">
            <BrandLogo className="h-8 w-8" />
            Up Indoor
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Entre para gerenciar suas TVs e campanhas.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            Faça login para liberar o dashboard administrativo. O player público das TVs
            continua funcionando separadamente.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
              Dashboard protegido por autenticação Supabase.
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
              CRUD liberado apenas para usuários autenticados.
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
              Primeiro acesso? Você pode criar a conta por esta mesma tela.
            </div>
          </div>
        </section>

        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <LockKeyhole className="h-5 w-5" />
              Acesso ao painel
            </CardTitle>
            <CardDescription>
              Use seu e-mail e senha para entrar ou criar sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConfigured ? (
              <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para habilitar a
                autenticação.
              </div>
            ) : (
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-background">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-6">
                  <AuthForm
                    submitLabel="Entrar no dashboard"
                    loadingLabel="Entrando..."
                    submitting={submitting}
                    onSubmit={async ({ email, password }) => {
                      setSubmitting(true);
                      try {
                        await signInWithPassword(email, password);
                        toast.success("Login realizado com sucesso.");
                        router.navigate({ to: "/" });
                      } catch (error) {
                        toast.error(getAuthErrorMessage(error));
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <AuthForm
                    submitLabel="Criar conta"
                    loadingLabel="Criando conta..."
                    submitting={submitting}
                    onSubmit={async ({ email, password }) => {
                      setSubmitting(true);
                      try {
                        const result = await signUp(email, password);
                        if (result.requiresEmailConfirmation) {
                          toast.success("Conta criada. Verifique seu e-mail para confirmar o acesso.");
                        } else {
                          toast.success("Conta criada com sucesso.");
                          router.navigate({ to: "/" });
                        }
                      } catch (error) {
                        toast.error(getAuthErrorMessage(error));
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}

            <p className="mt-6 text-center text-xs text-muted-foreground">
              O player continua disponível em links como <Link to="/" className="underline underline-offset-4">dashboard</Link>{" "}
              e <span className="font-mono">/player/&lt;screenId&gt;</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AuthForm({
  submitLabel,
  loadingLabel,
  submitting,
  onSubmit,
}: {
  submitLabel: string;
  loadingLabel: string;
  submitting: boolean;
  onSubmit: (values: { email: string; password: string }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({ email, password });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${submitLabel}-email`}>E-mail</Label>
        <Input
          id={`${submitLabel}-email`}
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${submitLabel}-password`}>Senha</Label>
        <div className="relative">
          <Input
            id={`${submitLabel}-password`}
            type={showPassword ? "text" : "password"}
            autoComplete={submitLabel === "Criar conta" ? "new-password" : "current-password"}
            placeholder="Sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            className="pr-11"
            required
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button
        type="submit"
        className="h-10 w-full gradient-brand text-brand-foreground"
        disabled={submitting}
      >
        {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {submitting ? loadingLabel : submitLabel}
      </Button>
    </form>
  );
}

function FullScreenMessage({ text }: { text: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return "Confirme seu e-mail antes de entrar.";
    }
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return "E-mail ou senha inválidos.";
    }
    return error.message;
  }

  return "Não foi possível concluir a autenticação.";
}
